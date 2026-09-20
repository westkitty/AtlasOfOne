export type AdventureKind =
  | 'social-dilemma'
  | 'investigation'
  | 'rescue-support'
  | 'exploration-expedition'
  | 'negotiation'
  | 'absurd-comedy-problem'
  | 'ethical-conflict'
  | 'creative-building-challenge'
  | 'memory-echo'
  | 'relationship-companion-scene'
  | 'mystery-puzzle'
  | 'survival-escape'
  | 'combat-forward-story'
  | 'pure-fun-wildcard';

export type AdventureLearningTarget = 'none' | 'reflection-eligible';
export type AdventureSeedStatus = 'available' | 'started' | 'retired';
export type AdventureRunStatus = 'active' | 'complete' | 'withdrawn';
export type AdventureActionKind = 'say' | 'do' | 'inspect' | 'travel' | 'combat' | 'leave';
export type AdventureObservationStatus = 'unreflected' | 'reflected' | 'discarded';
export type AdventureMemoryType = 'character' | 'place' | 'event' | 'relationship' | 'promise' | 'object';
export type AdventureMemoryStatus = 'active' | 'retired';
export type AdventureBeatRole = 'hook' | 'approach' | 'complication' | 'encounter' | 'choice' | 'consequence';
export type AdventureEncounterKind = 'none' | 'social' | 'puzzle' | 'combat' | 'mixed';

export interface AdventureSeed {
  id: string;
  sourceGapIds: string[];
  kind: AdventureKind;
  territoryId: string;
  locationId: string;
  premise: string;
  learningTarget: AdventureLearningTarget;
  status: AdventureSeedStatus;
}

export interface AdventureRun {
  id: string;
  seedId: string;
  territoryId: string;
  locationId: string;
  status: AdventureRunStatus;
  currentBeatId: string;
  recurringCharacterIds: string[];
  memoryIds: string[];
  startedAt: string;
  completedAt?: string;
}

export interface AdventureAction {
  id: string;
  runId: string;
  createdAt: string;
  kind: AdventureActionKind;
  text: string;
}

/** Fictional world state. It cannot be used as an EvidenceRecord. */
export interface AdventureObservation {
  id: string;
  runId: string;
  sourceActionIds: string[];
  observation: string;
  status: AdventureObservationStatus;
}

export interface AdventureMemory {
  id: string;
  type: AdventureMemoryType;
  summary: string;
  triggerTerms: string[];
  sourceIds: string[];
  privacy: 'normal' | 'private';
  status: AdventureMemoryStatus;
  lastUsedAt?: string;
}

export interface AdventureTemplateBeat {
  id: string;
  role: AdventureBeatRole;
  encounterKind: AdventureEncounterKind;
  prompt: string;
}

export interface AdventureTemplate {
  id: string;
  kind: AdventureKind;
  validTerritoryIds: string[];
  learningTarget: AdventureLearningTarget;
  requiredInputs: string[];
  beats: AdventureTemplateBeat[];
  withdrawalAllowed: boolean;
  memoryOutputTypes: AdventureMemoryType[];
  reflectionForm?: { question: string; sourceKind: 'adventure-observation' };
  cooldownClass: string;
}
