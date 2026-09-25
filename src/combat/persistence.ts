import { z } from 'zod';
import { COMBAT_INTENTS, COMBAT_STATUS_IDS, type CombatDefinition, type CombatState } from './types';

/**
 * C11 durable Combat state.
 *
 * Only deterministic engine state is persisted. Definitions are authored
 * content resolved by ID on resume; they are not user data and are not stored.
 */
const combatantStateSchema = z.object({
  id: z.string().min(1),
  side: z.enum(['player', 'enemy', 'ally']),
  maxHp: z.number().int().positive(),
  hp: z.number().int().nonnegative(),
  techniqueCharges: z.number().int().nonnegative()
}).strict().refine((actor) => actor.hp <= actor.maxHp, 'Combatant hp exceeds maxHp.');

const combatStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(COMBAT_STATUS_IDS),
  targetId: z.string().min(1),
  remainingRounds: z.number().int().nonnegative()
}).strict();

const combatIntentPlanSchema = z.object({
  round: z.number().int().positive(),
  enemyId: z.string().min(1),
  intent: z.enum(COMBAT_INTENTS),
  targetId: z.string().min(1),
  rawDamage: z.number().int().nonnegative(),
  telegraphKey: z.string().min(1)
}).strict();

export const combatStateSchema = z.object({
  definitionId: z.string().min(1),
  round: z.number().int().positive(),
  phase: z.enum(['player', 'enemy', 'resolved']),
  combatants: z.array(combatantStateSchema).min(2),
  statuses: z.array(combatStatusSchema),
  techniqueReadyRound: z.record(z.string(), z.number().int().nonnegative()),
  actProgressById: z.record(z.string(), z.number().int().nonnegative()),
  completedActIds: z.array(z.string()),
  objectiveProgress: z.number().int().nonnegative(),
  outcome: z.enum(['victory', 'pacified', 'escaped', 'defeat', 'story']).optional(),
  telegraphedIntents: z.array(combatIntentPlanSchema).optional()
}).strict().superRefine((state, ctx) => {
  if ((state.phase === 'resolved') !== (state.outcome !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Combat outcome must exist exactly when phase is resolved.' });
  }
  const ids = state.combatants.map((actor) => actor.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Duplicate combatant id.' });
  }
  if (state.combatants.filter((actor) => actor.side === 'player').length !== 1) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Combat state requires exactly one player.' });
  }
});

export const activeCombatRecordSchema = z.object({
  id: z.string().min(1),
  definitionId: z.string().min(1),
  encounterId: z.string().min(1),
  adventureRunId: z.string().min(1).optional(),
  startedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid startedAt.'),
  state: combatStateSchema
}).strict().refine((record) => record.state.definitionId === record.definitionId, 'Combat state/definition mismatch.');

export type ActiveCombatRecord = z.infer<typeof activeCombatRecordSchema>;

export function createActiveCombatRecord(input: {
  id: string;
  definition: CombatDefinition;
  state: CombatState;
  startedAt: string;
  adventureRunId?: string;
}): ActiveCombatRecord {
  return activeCombatRecordSchema.parse({
    id: input.id,
    definitionId: input.definition.id,
    encounterId: input.definition.encounterId,
    ...(input.adventureRunId ? { adventureRunId: input.adventureRunId } : {}),
    startedAt: input.startedAt,
    state: structuredClone(input.state)
  });
}

export type CombatResume =
  | { ok: true; definition: CombatDefinition; state: CombatState }
  | { ok: false; reason: 'unknown-definition' | 'combatant-mismatch' };

/**
 * Resume a persisted encounter against authored definitions.
 *
 * If content changed and the saved state no longer fits, resume fails closed;
 * the caller fail-forwards (clears the encounter) rather than guessing HP.
 */
export function resumeActiveCombat(
  record: ActiveCombatRecord,
  definitions: readonly CombatDefinition[]
): CombatResume {
  const definition = definitions.find((item) => item.id === record.definitionId);
  if (!definition) return { ok: false, reason: 'unknown-definition' };
  const expected = definition.combatants.map((actor) => `${actor.id}:${actor.side}:${actor.maxHp}`).sort();
  const actual = record.state.combatants.map((actor) => `${actor.id}:${actor.side}:${actor.maxHp}`).sort();
  if (expected.join('|') !== actual.join('|')) return { ok: false, reason: 'combatant-mismatch' };
  return { ok: true, definition, state: structuredClone(record.state) as CombatState };
}
