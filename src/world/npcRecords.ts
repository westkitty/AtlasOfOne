import { z } from 'zod';

/**
 * W04: NPC identity and state records, separated from art.
 *
 * Identity (who the NPC is) is keyed by a stable id and never changes when
 * art changes. Art is referenced only by an opaque asset id, never a path,
 * URL or file name. Mutable state (availability, runs they appeared in) lives
 * in a separate record so identity stays immutable.
 */

const STABLE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const npcIdentitySchema = z.object({
  id: z.string().regex(STABLE_ID),
  name: z.string().trim().min(1).max(60),
  territoryId: z.string().trim().min(1),
  role: z.string().trim().min(1).max(80),
  /** Opaque asset id resolved by the art manifest; '/', '.', ':' are rejected. */
  artAssetId: z.string().regex(STABLE_ID)
}).strict();
export type NpcIdentity = z.infer<typeof npcIdentitySchema>;

export const npcStateSchema = z.object({
  npcId: z.string().regex(STABLE_ID),
  availability: z.enum(['present', 'absent', 'departed']),
  appearedInRunIds: z.array(z.string().min(1)),
  memoryIds: z.array(z.string().min(1))
}).strict();
export type NpcState = z.infer<typeof npcStateSchema>;

export type NpcRegistry = ReadonlyMap<string, NpcIdentity>;

export function createNpcRegistry(records: readonly NpcIdentity[]): NpcRegistry {
  const registry = new Map<string, NpcIdentity>();
  for (const record of records) {
    const parsed = npcIdentitySchema.parse(record);
    if (registry.has(parsed.id)) throw new Error(`Duplicate NPC id: ${parsed.id}`);
    registry.set(parsed.id, Object.freeze(parsed));
  }
  return registry;
}

export function initialNpcState(npcId: string): NpcState {
  return npcStateSchema.parse({ npcId, availability: 'present', appearedInRunIds: [], memoryIds: [] });
}

/**
 * Record an appearance of a known NPC in an adventure run. Idempotent per run.
 * Unknown and departed NPCs fail closed.
 */
export function recordNpcAppearance(registry: NpcRegistry, state: NpcState, runId: string): NpcState {
  if (!registry.has(state.npcId)) throw new Error(`Unknown NPC: ${state.npcId}`);
  if (!runId.trim()) throw new Error('runId must not be empty.');
  if (state.availability === 'departed') throw new Error(`NPC ${state.npcId} has departed.`);
  if (state.appearedInRunIds.includes(runId)) return state;
  return { ...state, appearedInRunIds: [...state.appearedInRunIds, runId].sort() };
}

/** Swap art without touching identity: only artAssetId changes. */
export function withNpcArt(identity: NpcIdentity, artAssetId: string): NpcIdentity {
  return npcIdentitySchema.parse({ ...identity, artAssetId });
}
