import type {
  AssessmentDomainSection,
  ContradictionEntry
} from '../cartographer/finalize';
import type { CampaignState, EvidenceRecord, InsightRecord } from '../game/types';
import { selectQualifyingSnapshotProvenance, type AtlasSnapshotRequest } from './eligibility';
import { createAtlasSnapshotRecord, selectLatestAtlasSnapshot } from './history';
import type { AtlasSnapshot, AtlasSnapshotSynthesis } from './schema';

/**
 * S02 local, deterministic Snapshot synthesizer. No provider, no model.
 *
 * Input is an S01 request. Every requested ID is re-checked against current
 * provenance at synthesis time; a request that names anything no longer
 * qualifying (PRIVATE, retracted, non-player-stated, unconfirmed) throws rather
 * than silently shrinking, so a stale request cannot smuggle withheld material.
 *
 * Output is a dated, revisable reading: it lists Greyson's own supported
 * statements, confirmed insights, open contradictions and open questions,
 * remembers rejected interpretations as NOT reasserted, and never produces
 * framework estimates, diagnoses or a completion claim.
 */

export const LOCAL_SNAPSHOT_PROVIDER = 'local-snapshot';

type SectionKey =
  | 'temperament'
  | 'valuesAndMorals'
  | 'politicalAndIdeology'
  | 'relationshipsAndSocial'
  | 'cognitiveStyle'
  | 'interestsAndPreferences'
  | 'fearsAndHopes'
  | 'idealFutureAndAmbition';

const SECTIONS: ReadonlyArray<{ key: SectionKey; title: string; territory: string }> = [
  { key: 'temperament', title: 'Identity and temperament', territory: 'identity' },
  { key: 'valuesAndMorals', title: 'Values and moral architecture', territory: 'values' },
  { key: 'politicalAndIdeology', title: 'Politics and ideology', territory: 'politics' },
  { key: 'relationshipsAndSocial', title: 'Relationships and social world', territory: 'relationships' },
  { key: 'cognitiveStyle', title: 'Cognitive style', territory: 'cognition' },
  { key: 'interestsAndPreferences', title: 'Interests and ordinary preferences', territory: 'interests' },
  { key: 'fearsAndHopes', title: 'Aversions and fears', territory: 'fears' },
  { key: 'idealFutureAndAmbition', title: 'Hopes and ambition', territory: 'future' }
];

function sameIds(requested: readonly string[], allowed: readonly string[], label: string): string[] {
  const allowedSet = new Set(allowed);
  const unique = [...new Set(requested)].sort();
  const stale = unique.filter((id) => !allowedSet.has(id));
  if (stale.length > 0) {
    // Deliberately do not echo the IDs: they may name withheld records.
    throw new Error(`Snapshot request contains ${stale.length} non-qualifying ${label} reference(s).`);
  }
  return unique;
}

function sectionFor(record: EvidenceRecord): SectionKey | undefined {
  for (const territory of record.territories) {
    const match = SECTIONS.find((section) => section.territory === territory);
    if (match) return match.key;
  }
  return undefined;
}

function buildSection(
  title: string,
  evidence: EvidenceRecord[],
  insights: InsightRecord[]
): AssessmentDomainSection {
  const openQuestionsAndUncertainty: string[] = [];
  if (evidence.length === 0) {
    openQuestionsAndUncertainty.push('Not yet charted in this Snapshot; what belongs here is still open.');
  } else if (evidence.length === 1) {
    openQuestionsAndUncertainty.push('Only one supporting statement so far; this reading may change.');
  }

  return {
    title,
    summary: evidence.length === 0
      ? 'No confirmed statements yet.'
      : `${evidence.length} statement(s) Greyson made himself currently support this area.`,
    establishedEvidence: evidence.map((record) => record.claim),
    supportedInferences: insights.map((insight) => ({
      hypothesis: `${insight.title}: ${insight.summary}`,
      confidence: insight.confidence
    })),
    openQuestionsAndUncertainty
  };
}

export interface SynthesizeSnapshotInput {
  id: string;
  request: AtlasSnapshotRequest;
}

export function synthesizeLocalSnapshot(
  state: CampaignState,
  input: SynthesizeSnapshotInput
): AtlasSnapshot {
  const { request } = input;
  const qualifying = selectQualifyingSnapshotProvenance(state);
  const latest = selectLatestAtlasSnapshot(state.atlasSnapshots);

  if ((latest?.id) !== request.previousSnapshotId) {
    throw new Error('Snapshot request is stale: the latest Snapshot has changed.');
  }

  const evidenceIds = sameIds(request.evidenceIds, qualifying.evidenceIds, 'evidence');
  const insightIds = sameIds(request.insightIds, qualifying.insightIds, 'insight');
  const contradictionIds = sameIds(request.contradictionIds, qualifying.contradictionIds, 'contradiction');
  const rejectedInsightIds = sameIds(request.rejectedInsightIds, qualifying.rejectedInsightIds, 'rejected insight');

  const evidenceById = new Map(qualifying.evidence.map((record) => [record.id, record]));
  const evidence = evidenceIds.map((id) => evidenceById.get(id)!);
  const insightById = new Map(state.insights.map((record) => [record.id, record]));
  const insights = insightIds.map((id) => insightById.get(id)!);
  const rejected = rejectedInsightIds.map((id) => insightById.get(id)!);
  const contradictionById = new Map(state.contradictions.map((record) => [record.id, record]));
  const contradictions = contradictionIds.map((id) => contradictionById.get(id)!);

  const insightSection = (insight: InsightRecord) => {
    const first = insight.evidenceIds.map((id) => evidenceById.get(id)).find(Boolean);
    return first ? sectionFor(first) : undefined;
  };

  const sections = Object.fromEntries(SECTIONS.map(({ key, title }) => [
    key,
    buildSection(
      title,
      evidence.filter((record) => sectionFor(record) === key),
      insights.filter((insight) => insightSection(insight) === key)
    )
  ])) as Record<SectionKey, AssessmentDomainSection>;

  const contradictionsAndTensions: ContradictionEntry[] = contradictions.map((record) => ({
    tension: record.claim,
    evidence: [...record.evidenceIds].sort(),
    status: record.status === 'resolved' ? 'reconciled' : 'open'
  }));

  const date = request.requestedAt.slice(0, 10);
  const changeLine = latest
    ? ` Since the previous Snapshot, ${request.newSourceIds.filter((id) =>
      evidenceIds.includes(id) || insightIds.includes(id) || contradictionIds.includes(id)).length} source(s) are new.`
    : ' This is the first Snapshot, so there is nothing earlier to compare against yet.';

  const openQuestions = [
    ...SECTIONS
      .filter(({ key }) => sections[key].establishedEvidence.length === 0)
      .map(({ title }) => `${title} is still uncharted.`),
    ...(contradictionsAndTensions.some((entry) => entry.status === 'open')
      ? ['Open contradictions stay unresolved until Greyson says otherwise.']
      : []),
    ...rejected.map((insight) =>
      `Previously rejected interpretation, not reasserted: "${insight.title}".`)
  ];

  const synthesis: AtlasSnapshotSynthesis = {
    id: input.id,
    generatedAt: request.requestedAt,
    provider: LOCAL_SNAPSHOT_PROVIDER,
    whoIsGreyson:
      `Atlas Snapshot dated ${date}. It gathers ${evidence.length} statement(s) Greyson made himself, `
      + `${insights.length} confirmed insight(s) and ${contradictions.length} recorded tension(s). `
      + 'It is a revisable reading of what is currently supported, open to change as Greyson adds, revises or withdraws material.'
      + changeLine,
    ...sections,
    contradictionsAndTensions,
    frameworkEstimates: [],
    representativeQuotes: [],
    openQuestions
  };

  return createAtlasSnapshotRecord({
    id: input.id,
    createdAt: request.requestedAt,
    evidenceIds,
    insightIds: [...insightIds, ...rejectedInsightIds].sort(),
    contradictionIds,
    synthesis
  }, latest);
}
