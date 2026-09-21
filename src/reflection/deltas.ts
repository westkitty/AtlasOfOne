import type { CampaignState } from '../game/types';

type Evidence = CampaignState['evidence'][number];
type Turn = CampaignState['turns'][number];

export interface SupportedContradictionCandidate {
  id: string;
  evidenceIds: string[];
  dimensionIds: string[];
  territoryIds: string[];
  relation: 'counter-evidence';
}

export interface ChangeOverTimeCandidate {
  id: string;
  dimensionId: string;
  olderEvidenceId: string;
  newerEvidenceId: string;
  olderSourceTurnIds: string[];
  newerSourceTurnIds: string[];
  relation: 'counter-linked-revision' | 'same-dimension-revision';
}

export interface RefreshSupportedContradictionsOptions {
  now?: () => string;
}

interface EligibleEvidence {
  evidence: Evidence;
  sourceTurns: Turn[];
}

interface TimedEligibleEvidence extends EligibleEvidence {
  time: number;
}

const neutralContradictionClaim = 'Supported evidence is explicitly linked as counter-evidence.';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function candidateId(kind: string, ids: string[]): string {
  return `${kind}:${encodeURIComponent(JSON.stringify(ids))}`;
}

function uniqueTurnLookup(turns: Turn[]): Map<string, Turn> {
  const seen = new Map<string, Turn | null>();
  for (const turn of turns) {
    seen.set(turn.id, seen.has(turn.id) ? null : turn);
  }
  return new Map([...seen].filter((entry): entry is [string, Turn] => entry[1] !== null));
}

/**
 * Resolves active, public, player-provenanced evidence without reading its
 * claim or the source Turn's question/answer text. Ambiguous duplicate IDs
 * fail closed rather than arbitrarily choosing a record.
 */
function eligibleEvidence(state: CampaignState): Map<string, EligibleEvidence> {
  const turns = uniqueTurnLookup(state.turns);
  const evidenceById = new Map<string, Evidence | null>();
  for (const evidence of state.evidence) {
    evidenceById.set(evidence.id, evidenceById.has(evidence.id) ? null : evidence);
  }

  const eligible = new Map<string, EligibleEvidence>();
  for (const evidence of evidenceById.values()) {
    if (!evidence || evidence.status !== 'active' || state.privateTopics.includes(evidence.dimension) || evidence.sourceTurnIds.length === 0) continue;

    const sourceTurns = evidence.sourceTurnIds.map((id) => turns.get(id));
    if (sourceTurns.some((turn) => !turn)) continue;
    const resolvedTurns = sourceTurns as Turn[];
    if (resolvedTurns.some((turn) => turn.retracted || state.privateTopics.includes(turn.dimension))) continue;

    eligible.set(evidence.id, { evidence, sourceTurns: resolvedTurns });
  }
  return eligible;
}

function timedEligibleEvidence(eligible: Map<string, EligibleEvidence>): TimedEligibleEvidence[] {
  const timed: TimedEligibleEvidence[] = [];
  for (const entry of eligible.values()) {
    const sourceTimes = entry.sourceTurns.map((turn) => Date.parse(turn.createdAt));
    if (sourceTimes.some((time) => !Number.isFinite(time))) continue;
    timed.push({ ...entry, time: Math.max(...sourceTimes) });
  }
  return timed;
}

function pairKey(ids: string[]): string {
  return JSON.stringify(sortedUnique(ids));
}

function counterLinked(left: Evidence, right: Evidence): boolean {
  return left.counterEvidenceIds.includes(right.id) || right.counterEvidenceIds.includes(left.id);
}

/** Detects only explicit active counter-evidence links; it makes no conclusion. */
export function detectSupportedContradictionCandidates(state: CampaignState): SupportedContradictionCandidate[] {
  const eligible = eligibleEvidence(state);
  const candidates = new Map<string, SupportedContradictionCandidate>();

  for (const left of eligible.values()) {
    for (const rightId of left.evidence.counterEvidenceIds) {
      const right = eligible.get(rightId);
      if (!right || right.evidence.id === left.evidence.id) continue;

      const evidenceIds = sortedUnique([left.evidence.id, right.evidence.id]);
      const id = candidateId('supported-contradiction', evidenceIds);
      candidates.set(id, {
        id,
        evidenceIds,
        dimensionIds: sortedUnique([left.evidence.dimension, right.evidence.dimension]),
        territoryIds: sortedUnique([...left.evidence.territories, ...right.evidence.territories]),
        relation: 'counter-evidence'
      });
    }
  }

  return [...candidates.values()].sort((left, right) => compareText(left.id, right.id));
}

/** Appends neutral, unresolved history only; existing contradiction history is immutable here. */
export function refreshSupportedContradictions(state: CampaignState, options: RefreshSupportedContradictionsOptions = {}): CampaignState {
  const existingPairs = new Set(
    state.contradictions
      .filter((record) => record.evidenceIds.length === 2 && record.evidenceIds[0] !== record.evidenceIds[1])
      .map((record) => pairKey(record.evidenceIds))
  );
  const additions = detectSupportedContradictionCandidates(state)
    .filter((candidate) => !existingPairs.has(pairKey(candidate.evidenceIds)))
    .map((candidate) => ({
      id: candidate.id,
      claim: neutralContradictionClaim,
      evidenceIds: candidate.evidenceIds,
      status: 'open' as const
    }));

  if (additions.length === 0) return state;
  return {
    ...state,
    contradictions: [...state.contradictions, ...additions],
    updatedAt: options.now?.() ?? new Date().toISOString()
  };
}

/**
 * Reports a candidate when an explicitly marked player revision has a strictly
 * earlier, eligible evidence record in the same dimension. It never rewrites
 * either record or decides that one statement is false.
 */
export function detectChangeOverTimeCandidates(state: CampaignState): ChangeOverTimeCandidate[] {
  const eligible = eligibleEvidence(state);
  const timed = timedEligibleEvidence(eligible);
  const candidates: Array<ChangeOverTimeCandidate & { newerTime: number }> = [];

  for (const newer of timed) {
    if (newer.evidence.basis !== 'revision' || !newer.sourceTurns.some((turn) => turn.revision)) continue;

    const olderOptions = timed
      .filter((older) => older.evidence.id !== newer.evidence.id && older.evidence.dimension === newer.evidence.dimension && older.time < newer.time);
    const counterLinkedOptions = olderOptions.filter((older) => counterLinked(older.evidence, newer.evidence));
    const options = counterLinkedOptions.length > 0 ? counterLinkedOptions : olderOptions;
    const older = [...options].sort((left, right) => right.time - left.time || compareText(left.evidence.id, right.evidence.id))[0];
    if (!older) continue;

    candidates.push({
      id: candidateId('change-over-time', [older.evidence.id, newer.evidence.id]),
      dimensionId: newer.evidence.dimension,
      olderEvidenceId: older.evidence.id,
      newerEvidenceId: newer.evidence.id,
      olderSourceTurnIds: [...older.evidence.sourceTurnIds],
      newerSourceTurnIds: [...newer.evidence.sourceTurnIds],
      relation: counterLinked(older.evidence, newer.evidence) ? 'counter-linked-revision' : 'same-dimension-revision',
      newerTime: newer.time
    });
  }

  return candidates
    .sort((left, right) => left.newerTime - right.newerTime || compareText(left.newerEvidenceId, right.newerEvidenceId))
    .map(({ newerTime: _newerTime, ...candidate }) => candidate);
}
