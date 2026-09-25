import { ZodError } from 'zod';
import { proposalContainsForbiddenAuthority } from './proposals';
import { ProposalProvenanceError } from './proposalErrors';

export type ProposalFailureCode =
  | 'malformed'
  | 'authority-violation'
  | 'provenance-violation';

export type ProposalAttemptResult<T> =
  | { ok: true; proposal: T; repaired: boolean }
  | { ok: false; code: ProposalFailureCode; repairAttempted: boolean };

export type ProposalParser<T> = (value: unknown) => T;

/** Receives the original raw text and failure code; returns ONE replacement raw response. */
export type ProposalRepairCallback = (
  raw: string,
  code: ProposalFailureCode
) => Promise<string>;

type Classified<T> = { ok: true; proposal: T } | { ok: false; code: ProposalFailureCode };

function classify<T>(raw: string, parse: ProposalParser<T>): Classified<T> {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { ok: false, code: 'malformed' };
  }
  if (proposalContainsForbiddenAuthority(value)) {
    return { ok: false, code: 'authority-violation' };
  }
  try {
    return { ok: true, proposal: parse(value) };
  } catch (error) {
    if (error instanceof ProposalProvenanceError) return { ok: false, code: 'provenance-violation' };
    // P02's parseReflectionProposalForContext throws a plain Error with this marker.
    if (
      error instanceof Error
      && !(error instanceof ZodError)
      && /outside bounded context/.test(error.message)
    ) {
      return { ok: false, code: 'provenance-violation' };
    }
    return { ok: false, code: 'malformed' };
  }
}

/**
 * P07 single-repair / no-loop policy for the new provider modes.
 *
 * - Parse the raw provider response with the supplied (context-bound) parser.
 * - Only a `malformed` response may be repaired, and at most ONCE.
 * - Authority and provenance violations are never negotiated: they fail
 *   immediately so callers degrade to a local fallback.
 * - A repair callback that throws, or a repaired response that still fails,
 *   yields a typed failure. There is no loop.
 */
export async function parseProposalWithSingleRepair<T>(
  raw: string,
  parse: ProposalParser<T>,
  repair?: ProposalRepairCallback
): Promise<ProposalAttemptResult<T>> {
  const first = classify(raw, parse);
  if (first.ok) return { ok: true, proposal: first.proposal, repaired: false };
  if (first.code !== 'malformed' || !repair) {
    return { ok: false, code: first.code, repairAttempted: false };
  }

  let repairedRaw: string;
  try {
    repairedRaw = await repair(raw, first.code);
  } catch {
    return { ok: false, code: 'malformed', repairAttempted: true };
  }

  const second = classify(repairedRaw, parse);
  if (second.ok) return { ok: true, proposal: second.proposal, repaired: true };
  return { ok: false, code: second.code, repairAttempted: true };
}
