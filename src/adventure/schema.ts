import { z } from 'zod';

export const ADVENTURE_KINDS = [
  'social-dilemma',
  'investigation',
  'rescue-support',
  'exploration-expedition',
  'negotiation',
  'absurd-comedy',
  'ethical-conflict',
  'creative-building',
  'memory-echo',
  'relationship-companion',
  'mystery-puzzle',
  'survival-escape',
  'combat-forward',
  'pure-fun'
] as const;

export const adventureKindSchema = z.enum(ADVENTURE_KINDS);
export type AdventureKind = z.infer<typeof adventureKindSchema>;

export const adventureSeedSchema = z.object({
  id: z.string(),
  sourceGapIds: z.array(z.string()),
  kind: adventureKindSchema,
  territoryId: z.string(),
  premise: z.string(),
  learningTarget: z.enum(['none', 'reflection-eligible']),
  status: z.enum(['available', 'started', 'retired'])
});
export type AdventureSeed = z.infer<typeof adventureSeedSchema>;

export const adventureRunSchema = z.object({
  id: z.string(),
  seedId: z.string(),
  territoryId: z.string(),
  status: z.enum(['active', 'complete', 'withdrawn']),
  currentBeat: z.string(),
  characterIds: z.array(z.string()),
  memoryIds: z.array(z.string()),
  startedAt: z.string(),
  completedAt: z.string().optional()
});
export type AdventureRun = z.infer<typeof adventureRunSchema>;

export const adventureActionSchema = z.object({
  id: z.string(),
  runId: z.string(),
  createdAt: z.string(),
  kind: z.enum(['say', 'do', 'inspect', 'travel', 'combat', 'leave']),
  text: z.string()
});
export type AdventureAction = z.infer<typeof adventureActionSchema>;

export const adventureObservationSchema = z.object({
  id: z.string(),
  runId: z.string(),
  sourceActionIds: z.array(z.string()),
  observation: z.string(),
  status: z.enum(['unreflected', 'reflected', 'discarded'])
});
export type AdventureObservation = z.infer<typeof adventureObservationSchema>;

export const adventureMemorySchema = z.object({
  id: z.string(),
  type: z.enum(['character', 'place', 'event', 'relationship', 'promise', 'object']),
  summary: z.string(),
  triggerTerms: z.array(z.string()),
  sourceIds: z.array(z.string()),
  privacy: z.enum(['normal', 'private']),
  status: z.enum(['active', 'retired']),
  lastUsedAt: z.string().optional()
});
export type AdventureMemory = z.infer<typeof adventureMemorySchema>;
