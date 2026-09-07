import type { GameEvent } from '../game/types';
import { recordsFromMockTurn, type MockPrompt } from './mock';
import type { CartographerTurn } from './schema';

/**
 * The single crossing point from Cartographer output into campaign state.
 *
 * This is the whole surface a provider has. It can emit exactly three event
 * types, none of which carries XP, a level, an unlock, an achievement, a quest
 * completion, a territory threshold, a map fragment, an encounter outcome or
 * campaign completion. Those events exist in the vocabulary, but no provider
 * output can reach them, because nothing here constructs one.
 *
 * If this function ever grows a fourth event type, the model-authority firewall
 * tests must be re-read before it is accepted.
 */
export const PROVIDER_EVENT_TYPES = ['ANSWER_ACCEPTED', 'EVIDENCE_ADDED', 'INSIGHT_ADDED'] as const;

export function eventsFromTurn(prompt: MockPrompt, answer: string, turn: CartographerTurn, providerId: string): GameEvent[] {
  const records = recordsFromMockTurn(prompt, answer, turn, providerId);
  const events: GameEvent[] = [
    { type: 'ANSWER_ACCEPTED', turn: records.turnRecord },
    ...records.evidence.map((evidence) => ({ type: 'EVIDENCE_ADDED', evidence }) as GameEvent)
  ];
  if (records.insight) events.push({ type: 'INSIGHT_ADDED', insight: records.insight });
  return events;
}
