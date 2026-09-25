/**
 * C14 timed-input accessibility boundary.
 *
 * Timing is texture, never a gate (COMBAT_CONTRACT §12). This module turns a
 * raw UI timing sample into the single boolean the engine accepts
 * (`timedSuccess`). Every non-timed path — keyboard activation, touch tap
 * without a timing sample, reduced motion, or simply declining — maps to
 * `false`, which the engine resolves as the ordinary base action. There is
 * no `failed` timing state, so a missed or absent timing input can never
 * produce a penalty. No clocks are read here: callers inject samples.
 */

export type TimingInputMode = 'timed-pointer' | 'keyboard' | 'touch' | 'reduced-motion' | 'declined';

/** Generous window (ms, either side of the cue). No frame-perfect mechanics. */
export const TIMING_WINDOW_MS = 300;

export interface TimingSample {
  mode: TimingInputMode;
  /**
   * Signed distance in ms between the input and the cue peak. Only read for
   * `timed-pointer`; other modes ignore it entirely.
   */
  offsetMs?: number;
  /** Player preference; when true, animated timing cues are never judged. */
  reducedMotion?: boolean;
}

/**
 * Returns true only for an opted-in timed input inside the generous window.
 * Anything else — including malformed samples — is the base action.
 */
export function resolveTimedSuccess(sample: TimingSample | undefined): boolean {
  if (!sample || sample.reducedMotion === true) return false;
  if (sample.mode !== 'timed-pointer') return false;
  const offset = sample.offsetMs;
  if (typeof offset !== 'number' || !Number.isFinite(offset)) return false;
  return Math.abs(offset) <= TIMING_WINDOW_MS;
}

/** Whether the UI should offer a timing prompt at all. Reduced motion never shows one. */
export function timingPromptOffered(reducedMotion: boolean): boolean {
  return !reducedMotion;
}
