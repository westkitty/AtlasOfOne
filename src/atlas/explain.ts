import type { CampaignState, EvidenceRecord, InsightRecord } from '../game/types';
import { createV2ProvenanceVisibility } from '../persistence/retirement';
import type { ReflectionRecord } from '../reflection/schema';

/**
 * RF08 explainability (plan 13.4).
 *
 * Answers, for one Insight: what sources support it, which were explicit vs
 * inferred, did Greyson confirm it (Reflection decisions), is there
 * counter-evidence (open contradictions sharing evidence), and has it changed
 * over time (Snapshots that cite it).
 *
 * PRIVATE/retracted sources are never shown: they are reported only as a
 * count of withheld sources. If the Insight itself is no longer eligible,
 * nothing about it is returned beyond its ID and the `withheld` kind.
 */

export interface ExplainedEvidence {
  id: string;
  dimension: string;
  basis: EvidenceRecord['basis'];
  origin: EvidenceRecord['origin'];
}

export interface ExplainedReflection {
  id: string;
  decision: ReflectionRecord['decision'] | null;
  epistemicStatus: ReflectionRecord['epistemicStatus'];
  createdAt: string;
}

export interface InsightExplanationData {
  kind: 'explained';
  insightId: string;
  title: string;
  status: InsightRecord['status'];
  confidence: InsightRecord['confidence'];
  createdAt: string;
  evidence: ExplainedEvidence[];
  reflections: ExplainedReflection[];
  counterContradictionIds: string[];
  snapshots: Array<{ id: string; createdAt: string }>;
  withheldSourceCount: number;
}

export interface WithheldInsightExplanation {
  kind: 'withheld';
  insightId: string;
}

export type InsightExplanationResult = InsightExplanationData | WithheldInsightExplanation;

export function explainInsight(state: CampaignState, insightId: string): InsightExplanationResult {
  const insight = state.insights.find((record) => record.id === insightId);
  if (!insight) throw new Error(`Unknown InsightRecord id: ${insightId}`);

  const visibility = createV2ProvenanceVisibility(state);
  if (!visibility.insightIsEligible(insight.id)) return { kind: 'withheld', insightId };

  let withheld = 0;
  const evidenceById = new Map(state.evidence.map((record) => [record.id, record]));

  const evidence: ExplainedEvidence[] = [];
  for (const id of [...new Set(insight.evidenceIds)].sort()) {
    const record = evidenceById.get(id);
    if (!record || !visibility.evidenceIsEligible(id)) {
      withheld += 1;
      continue;
    }
    evidence.push({ id, dimension: record.dimension, basis: record.basis, origin: record.origin });
  }

  const reflections: ExplainedReflection[] = [];
  for (const record of state.reflections) {
    if (record.sourceKind !== 'insight' || !record.sourceIds.includes(insight.id)) continue;
    if (!visibility.reflectionIsEligible(record.id)) {
      withheld += 1;
      continue;
    }
    reflections.push({
      id: record.id,
      decision: record.decision ?? null,
      epistemicStatus: record.epistemicStatus,
      createdAt: record.createdAt
    });
  }
  reflections.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  const insightEvidence = new Set(insight.evidenceIds);
  const counterContradictionIds: string[] = [];
  for (const record of state.contradictions) {
    if (record.status !== 'open' || !record.evidenceIds.some((id) => insightEvidence.has(id))) continue;
    if (!visibility.contradictionIsEligible(record.id)) {
      withheld += 1;
      continue;
    }
    counterContradictionIds.push(record.id);
  }
  counterContradictionIds.sort();

  const snapshots: Array<{ id: string; createdAt: string }> = [];
  for (const record of state.atlasSnapshots) {
    if (!record.insightIds.includes(insight.id)) continue;
    if (!visibility.atlasSnapshotIsEligible(record.id)) {
      withheld += 1;
      continue;
    }
    snapshots.push({ id: record.id, createdAt: record.createdAt });
  }
  snapshots.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  return {
    kind: 'explained',
    insightId: insight.id,
    title: insight.title,
    status: insight.status,
    confidence: insight.confidence,
    createdAt: insight.createdAt,
    evidence,
    reflections,
    counterContradictionIds,
    snapshots,
    withheldSourceCount: withheld
  };
}
