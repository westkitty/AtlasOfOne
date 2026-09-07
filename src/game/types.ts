export type TerritoryStatus =
  | 'fogged'
  | 'discovered'
  | 'exploring'
  | 'charted'
  | 'deeply-charted';

export type EvidenceBasis = 'explicit' | 'example' | 'inference' | 'revision';
export type EvidenceStatus = 'active' | 'retracted' | 'contested';
export type InsightStatus = 'pending' | 'confirmed' | 'rejected';
export type PresentationMode = 'normal' | 'quiet';
export type SessionStatus = 'active' | 'paused';
export type SassLevel = 'low' | 'medium' | 'risks-understood';

export interface PlayerState { id: string; displayName: string; pronouns: string; }
export interface SettingsState { sass: SassLevel; reducedMotion: boolean; voiceMode: 'text' | 'talk'; }
export interface TerritoryState { id: string; label: string; status: TerritoryStatus; requiredDimensions: string[]; coveredDimensions: string[]; evidenceIds: string[]; }
export interface QuestState { id: string; label: string; description: string; progress: number; target: number; xpBonus: number; status: 'active' | 'complete'; }
export interface UnlockState { id: string; label: string; description: string; levelRequired: number; unlockedAt?: string; }
export interface AchievementState { id: string; label: string; description: string; unlockedAt?: string; }
export interface TurnRecord { id: string; createdAt: string; territoryId: string; dimension: string; question: string; answer: string; substantive: boolean; behavioralExample: boolean; revision: boolean; retracted: boolean; }
export interface EvidenceRecord { id: string; dimension: string; claim: string; sourceTurnIds: string[]; basis: EvidenceBasis; strength: 1 | 2 | 3; territories: string[]; counterEvidenceIds: string[]; status: EvidenceStatus; }
export interface InsightRecord { id: string; title: string; summary: string; evidenceIds: string[]; confidence: 'low' | 'moderate' | 'strong'; status: InsightStatus; createdAt: string; }
export interface ContradictionRecord { id: string; claim: string; evidenceIds: string[]; status: 'open' | 'resolved'; }
export interface MapFragment { id: string; territoryId: string; label: string; unlockedAt: string; }
export interface PresentationNotice { id: string; kind: 'level' | 'unlock' | 'achievement' | 'quest' | 'territory'; title: string; detail: string; createdAt: string; }
export interface GameHistoryEntry { id: string; type: GameEvent['type']; at: string; detail?: string; }

export interface CampaignState {
  schemaVersion: 1;
  campaignId: string;
  player: PlayerState;
  settings: SettingsState;
  xp: number;
  level: number;
  territories: TerritoryState[];
  quests: QuestState[];
  achievements: AchievementState[];
  unlocks: UnlockState[];
  activeTerritory: string;
  activeQuest: string | null;
  turns: TurnRecord[];
  evidence: EvidenceRecord[];
  insights: InsightRecord[];
  contradictions: ContradictionRecord[];
  mapFragments: MapFragment[];
  privateTopics: string[];
  presentation: PresentationMode;
  sessionStatus: SessionStatus;
  campaignCompleted: boolean;
  presentationQueue: PresentationNotice[];
  campaignHistory: GameHistoryEntry[];
  updatedAt: string;
}

export type GameEvent =
  | { type: 'ANSWER_ACCEPTED'; turn: TurnRecord }
  | { type: 'EVIDENCE_ADDED'; evidence: EvidenceRecord }
  | { type: 'QUEST_PROGRESS'; questId: string; amount: number }
  | { type: 'QUEST_COMPLETE'; questId: string }
  | { type: 'TERRITORY_ADVANCED'; territoryId: string; status: TerritoryStatus }
  | { type: 'LEVEL_UP'; level: number }
  | { type: 'ABILITY_UNLOCKED'; unlockId: string }
  | { type: 'ACHIEVEMENT_UNLOCKED'; achievementId: string }
  | { type: 'MAP_FRAGMENT_UNLOCKED'; fragment: MapFragment }
  | { type: 'INSIGHT_ADDED'; insight: InsightRecord }
  | { type: 'INSIGHT_CONFIRMED'; insightId: string }
  | { type: 'INSIGHT_REJECTED'; insightId: string }
  | { type: 'ANSWER_RETRACTED'; turnId: string }
  | { type: 'PRIVATE_TOPIC_ADDED'; topic: string }
  | { type: 'PRESENTATION_SET'; mode: PresentationMode }
  | { type: 'SESSION_SET'; status: SessionStatus }
  | { type: 'SASS_SET'; sass: SassLevel }
  | { type: 'ACTIVE_TERRITORY_SET'; territoryId: string }
  | { type: 'PRESENTATION_QUEUE_CLEARED' }
  | { type: 'CAMPAIGN_COMPLETED' };
