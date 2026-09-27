import { z } from 'zod';
import { finalAssessmentSchema } from '../cartographer/finalize';

const timestamp = z.string();
export const campaignStateSchemaV1 = z.object({
  schemaVersion: z.literal(1), campaignId: z.string(),
  player: z.object({ id: z.string(), displayName: z.string(), pronouns: z.string() }),
  settings: z.object({ sass: z.enum(['low','medium','risks-understood']), reducedMotion: z.boolean(), voiceMode: z.enum(['text','talk']) }),
  xp: z.number().nonnegative(), level: z.number().int().min(1).max(8),
  territories: z.array(z.object({ id: z.string(), label: z.string(), status: z.enum(['fogged','discovered','exploring','charted','deeply-charted']), requiredDimensions: z.array(z.string()), coveredDimensions: z.array(z.string()), evidenceIds: z.array(z.string()) })),
  quests: z.array(z.object({ id: z.string(), label: z.string(), description: z.string(), progress: z.number(), target: z.number(), xpBonus: z.number(), status: z.enum(['active','complete']) })),
  achievements: z.array(z.object({ id: z.string(), label: z.string(), description: z.string(), unlockedAt: timestamp.optional() })),
  unlocks: z.array(z.object({ id: z.string(), label: z.string(), description: z.string(), levelRequired: z.number(), unlockedAt: timestamp.optional() })),
  activeTerritory: z.string(), activeQuest: z.string().nullable(),
  turns: z.array(z.object({ id: z.string(), createdAt: timestamp, territoryId: z.string(), dimension: z.string(), question: z.string(), answer: z.string(), substantive: z.boolean(), behavioralExample: z.boolean(), revision: z.boolean(), retracted: z.boolean() })),
  evidence: z.array(z.object({ id: z.string(), dimension: z.string(), claim: z.string(), sourceTurnIds: z.array(z.string()), basis: z.enum(['explicit','example','inference','revision']), strength: z.union([z.literal(1),z.literal(2),z.literal(3)]), territories: z.array(z.string()), counterEvidenceIds: z.array(z.string()), status: z.enum(['active','retracted','contested']), origin: z.enum(['player-stated','model-proposed','engine-derived']).default('model-proposed'), providerId: z.string().optional() })),
  insights: z.array(z.object({ id: z.string(), title: z.string(), summary: z.string(), evidenceIds: z.array(z.string()), confidence: z.enum(['low','moderate','strong']), status: z.enum(['pending','confirmed','rejected']), createdAt: timestamp })),
  contradictions: z.array(z.object({ id: z.string(), claim: z.string(), evidenceIds: z.array(z.string()), status: z.enum(['open','resolved']) })),
  mapFragments: z.array(z.object({ id: z.string(), territoryId: z.string(), label: z.string(), unlockedAt: timestamp })),
  bossRuns: z.array(z.object({ id: z.string(), bossId: z.string(), territoryId: z.string(), stages: z.array(z.object({ id: z.string(), kind: z.enum(['priority','tradeoff','contradiction']), dimensions: z.array(z.string()), evidenceIds: z.array(z.string()), outcome: z.enum(['pending','answered','passed','private']) })), status: z.enum(['active','complete','withdrawn']), startedAt: timestamp, completedAt: timestamp.optional() })).default([]),
  activeBoss: z.string().nullable().default(null),
  doorRuns: z.array(z.object({ id: z.string(), doorId: z.string(), territoryIds: z.array(z.string()), evidenceIds: z.array(z.string()), dimensions: z.array(z.string()), status: z.enum(['open','complete']), openedAt: timestamp, completedAt: timestamp.optional() })).default([]),
  activeDoor: z.string().nullable().default(null),
  privateTopics: z.array(z.string()), presentation: z.enum(['normal','quiet']), sessionStatus: z.enum(['active','paused']), campaignCompleted: z.boolean(),
  presentationQueue: z.array(z.object({ id: z.string(), kind: z.enum(['level','unlock','achievement','quest','territory','fragment']), title: z.string(), detail: z.string(), createdAt: timestamp })),
  campaignHistory: z.array(z.object({ id: z.string(), type: z.string(), at: timestamp, detail: z.string().optional() })),
  worldJourney: z.object({
    visitedTerritoryIds: z.array(z.string()),
    discoveredLandmarkIds: z.array(z.string()),
    lastPosition: z.object({ x: z.number(), y: z.number(), territoryId: z.string() }).nullable(),
    recentArrivals: z.array(z.object({ territoryId: z.string(), at: timestamp })),
    traversedRoutes: z.array(z.string()),
    encounterLocations: z.array(z.object({ kind: z.enum(['boss','door']), id: z.string(), territoryId: z.string(), at: timestamp }))
  }).default({
    visitedTerritoryIds: [],
    discoveredLandmarkIds: [],
    lastPosition: null,
    recentArrivals: [],
    traversedRoutes: [],
    encounterLocations: []
  }),
  finalAssessment: finalAssessmentSchema.nullable().optional().default(null),
  onboardingCompleted: z.boolean().optional().default(false),
  updatedAt: timestamp
});

const journalEntrySchema = z.object({
  id: z.string(), createdAt: timestamp, text: z.string(), inputMode: z.enum(['typed', 'speech-to-text']),
  privacy: z.enum(['normal', 'private']), status: z.enum(['active', 'retracted']), sourcePrompt: z.string().optional(),
  reflectionIds: z.array(z.string()), adventureIds: z.array(z.string())
});

const knowledgeGapSchema = z.object({
  id: z.string(), kind: z.enum(['unknown', 'contradiction', 'change', 'underexplored', 'curiosity']),
  territoryIds: z.array(z.string()), dimensionIds: z.array(z.string()), sourceEvidenceIds: z.array(z.string()),
  sourceJournalEntryIds: z.array(z.string()), summary: z.string(), status: z.enum(['open', 'seeded', 'resolved', 'retired']), priority: z.number()
});

const reflectionRecordSchema = z.object({
  id: z.string(), sourceKind: z.enum(['journal', 'adventure-observation', 'contradiction', 'insight', 'snapshot']),
  sourceIds: z.array(z.string()), question: z.string(), response: z.string(), interpretation: z.string().optional(),
  createdAt: timestamp, outcome: z.enum(['CONFIRM', 'PARTIAL', 'REJECT', 'UNCERTAIN', 'REVISE', 'PRIVATE']),
  evidenceProvenance: z.object({ responseSourceId: z.string(), sourceIds: z.array(z.string()) }).optional(),
  rejectedInterpretation: z.string().optional(), revisionTargetId: z.string().optional(), privacyRetiredSourceIds: z.array(z.string()).optional()
});

const adventureSeedSchema = z.object({
  id: z.string(), sourceGapIds: z.array(z.string()),
  kind: z.enum(['social-dilemma', 'investigation', 'rescue-support', 'exploration-expedition', 'negotiation', 'absurd-comedy-problem', 'ethical-conflict', 'creative-building-challenge', 'memory-echo', 'relationship-companion-scene', 'mystery-puzzle', 'survival-escape', 'combat-forward-story', 'pure-fun-wildcard']),
  territoryId: z.string(), locationId: z.string(), premise: z.string(), learningTarget: z.enum(['none', 'reflection-eligible']), status: z.enum(['available', 'started', 'retired'])
});

const adventureRunSchema = z.object({
  id: z.string(), seedId: z.string(), territoryId: z.string(), locationId: z.string(), status: z.enum(['active', 'complete', 'withdrawn']),
  currentBeatId: z.string(), recurringCharacterIds: z.array(z.string()), memoryIds: z.array(z.string()), startedAt: timestamp, completedAt: timestamp.optional()
});

const adventureActionSchema = z.object({
  id: z.string(), runId: z.string(), createdAt: timestamp, kind: z.enum(['say', 'do', 'inspect', 'travel', 'combat', 'leave']), text: z.string()
});

const adventureObservationSchema = z.object({
  id: z.string(), runId: z.string(), sourceActionIds: z.array(z.string()), observation: z.string(), status: z.enum(['unreflected', 'reflected', 'discarded'])
});

const adventureMemorySchema = z.object({
  id: z.string(), type: z.enum(['character', 'place', 'event', 'relationship', 'promise', 'object']), summary: z.string(),
  triggerTerms: z.array(z.string()), sourceIds: z.array(z.string()), privacy: z.enum(['normal', 'private']), status: z.enum(['active', 'retired']), lastUsedAt: timestamp.optional()
});

const atlasSnapshotSchema = z.object({
  id: z.string(), createdAt: timestamp, evidenceIds: z.array(z.string()), insightIds: z.array(z.string()), contradictionIds: z.array(z.string()),
  synthesis: z.object({ summary: z.string(), territorySummaries: z.array(z.object({ territoryId: z.string(), summary: z.string() })) }),
  previousSnapshotId: z.string().optional(),
  provenance: z.object({ kind: z.enum(['snapshot', 'legacy-final-assessment']), sourceFinalAssessmentId: z.string().optional() }),
  eligibility: z.enum(['eligible', 'retired', 'historical-ineligible']), legacyFinalAssessment: finalAssessmentSchema.optional(),
  detail: finalAssessmentSchema.optional()
});

const combatDefinitionSchema = z.object({
  id: z.string(), encounterId: z.string(),
  objective: z.enum(['defeat', 'survive-turns', 'escape', 'protect-target', 'interrupt-charged-action', 'pacify', 'break-object', 'hold-position', 'escort', 'discover-act']),
  gimmicks: z.array(z.enum(['shielded', 'charging', 'counterattacking', 'enraged', 'healing', 'swarm', 'linked-pair', 'stance-changing', 'mimic-disguise', 'unstable-terrain', 'morale-fear', 'timed-vulnerability', 'environmental-hazard', 'ally-in-danger', 'nonlethal'])),
  combatants: z.array(z.object({ id: z.string(), templateId: z.string(), team: z.enum(['player', 'enemy', 'ally']), maxHp: z.number() })),
  turnLimit: z.number().int().positive().optional(), rewards: z.array(z.object({ id: z.string(), kind: z.enum(['story', 'map', 'route', 'memory', 'artifact', 'xp', 'technique']), amount: z.number().optional() })),
  fleeRule: z.enum(['always', 'after-turn', 'story-gated'])
});

const combatStateSchema = z.object({
  definitionId: z.string(), round: z.number().int().nonnegative(), phase: z.enum(['player', 'enemy', 'resolved']),
  combatants: z.array(z.object({ id: z.string(), currentHp: z.number(), statuses: z.array(z.string()) })),
  statuses: z.array(z.string()), objectiveProgress: z.number(), outcome: z.enum(['victory', 'pacified', 'escaped', 'defeat', 'story']).optional()
});

const combatRuntimeSchema = z.object({
  definitionId: z.string(),
  scenario: z.object({ options: z.array(z.object({
    id: z.string(), label: z.string(), targetTeam: z.enum(['enemy', 'ally', 'none']), effect: z.enum(['act-progress', 'reveal']), repeatable: z.boolean(),
    requiredGimmicks: z.array(z.string()).optional(), requiredTargetStatuses: z.array(z.string()).optional(), forbiddenTargetStatuses: z.array(z.string()).optional(),
    requiresUsed: z.array(z.string()).optional(), observationKey: z.string().optional()
  })).max(12) }),
  turn: z.number().int().nonnegative(),
  techniques: z.object({ chargesRemaining: z.number().int().nonnegative(), cooldowns: z.array(z.object({ techniqueId: z.string(), nextReadyRound: z.number().int().positive() })) }),
  acts: z.object({ usedOptionIds: z.array(z.string()) }),
  pendingGuard: z.object({ combatantId: z.string(), timing: z.enum(['base', 'timed']) }).optional(),
  log: z.array(z.object({ kind: z.string() }).passthrough()).max(16)
});

/** Full durable v2 aggregate. Empty collections are valid until their lanes land. */
export const campaignStateSchemaV2 = campaignStateSchemaV1.extend({
  schemaVersion: z.literal(2),
  journalEntries: z.array(journalEntrySchema), knowledgeGaps: z.array(knowledgeGapSchema), reflections: z.array(reflectionRecordSchema),
  adventureSeeds: z.array(adventureSeedSchema), adventureRuns: z.array(adventureRunSchema), adventureActions: z.array(adventureActionSchema),
  adventureObservations: z.array(adventureObservationSchema), adventureMemories: z.array(adventureMemorySchema),
  atlasSnapshots: z.array(atlasSnapshotSchema), combatDefinitions: z.array(combatDefinitionSchema), activeCombat: combatStateSchema.nullable(),
  // Additive within v2: saves written before C11 parse with no runtime, i.e. no resumable combat ledgers.
  activeCombatRuntime: combatRuntimeSchema.nullable().default(null)
});
