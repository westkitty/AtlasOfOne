import type { ReflectionProposal } from '../cartographer/reflectionProposal';
import type { SnapshotProposal } from '../cartographer/snapshotProposal';
import type { CampaignState } from '../game/types';
import { createV2ProvenanceVisibility } from '../persistence/retirement';

/**
 * RF04 rejected-interpretation anti-repeat context.
 *
 * Plan 13.3: "A rejection must be remembered strongly enough that Atlas does
 * not keep proposing the same interpretation."
 *
 * Two deterministic pieces:
 * 1. `selectRejectedInterpretations` — the list supplied to provider context
 *    as "do not reassert". Sources are Reflections Greyson rejected (their
 *    interpretation text) and Insights with live status `rejected`.
 *    PRIVATE/retracted material is excluded ENTIRELY via M06 visibility: no
 *    text, no ID, no count.
 * 2. `proposalReassertsRejected` — a post-validation guard that flags a
 *    Reflection/Snapshot proposal whose interpretation text matches a rejected
 *    one after normalization (exact, or near-exact by a small bounded edit
 *    distance). No ML, no synonyms, no paraphrase detection.
 */

export interface RejectedInterpretation {
  /** Source record ID (ReflectionRecord or InsightRecord). */
  id: string;
  kind: 'reflection' | 'insight';
  text: string;
}

/** Lowercase, NFKC, strip punctuation, collapse whitespace. */
export function normalizeInterpretation(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function selectRejectedInterpretations(state: CampaignState): RejectedInterpretation[] {
  const visibility = createV2ProvenanceVisibility(state);
  const candidates: RejectedInterpretation[] = [];

  for (const record of state.reflections) {
    if (record.decision !== 'reject' || record.epistemicStatus !== 'rejected') continue;
    // reflectionIsEligible already requires active + normal privacy + eligible sources.
    if (!visibility.reflectionIsEligible(record.id)) continue;
    const text = record.interpretation?.trim();
    if (!text) continue;
    candidates.push({ id: record.id, kind: 'reflection', text });
  }

  for (const insight of state.insights) {
    if (insight.status !== 'rejected') continue;
    if (!visibility.insightIsEligible(insight.id)) continue;
    const text = insight.title.trim();
    if (!text) continue;
    candidates.push({ id: insight.id, kind: 'insight', text });
  }

  candidates.sort((a, b) => a.id.localeCompare(b.id));

  // Dedupe by normalized text; keep the first (lowest ID) for stable output.
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = normalizeInterpretation(candidate.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

/**
 * Near-exact threshold: at most 10% of the longer normalized string, floored,
 * and never more than 3 edits. Short strings (< 10 chars) must match exactly.
 */
export function interpretationsMatch(left: string, right: string): boolean {
  const a = normalizeInterpretation(left);
  const b = normalizeInterpretation(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const limit = Math.min(3, Math.floor(Math.max(a.length, b.length) * 0.1));
  if (limit === 0) return false;
  return editDistance(a, b, limit) <= limit;
}

export interface RejectedReassertion {
  rejectedId: string;
  proposalText: string;
}

function proposalInterpretationTexts(proposal: ReflectionProposal | SnapshotProposal): string[] {
  if (proposal.kind === 'reflection') {
    return proposal.interpretationCandidate ? [proposal.interpretationCandidate] : [];
  }
  return [proposal.summary, ...proposal.claims.map((claim) => claim.text)];
}

export function findRejectedReassertions(
  proposal: ReflectionProposal | SnapshotProposal,
  rejected: readonly RejectedInterpretation[]
): RejectedReassertion[] {
  const matches: RejectedReassertion[] = [];
  for (const proposalText of proposalInterpretationTexts(proposal)) {
    for (const item of rejected) {
      if (interpretationsMatch(proposalText, item.text)) {
        matches.push({ rejectedId: item.id, proposalText });
      }
    }
  }
  return matches;
}

export function proposalReassertsRejected(
  proposal: ReflectionProposal | SnapshotProposal,
  rejected: readonly RejectedInterpretation[]
): boolean {
  return findRejectedReassertions(proposal, rejected).length > 0;
}
