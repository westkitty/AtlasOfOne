import type { AchievementState, BossDefinition, QuestState, TerritoryState, UnlockState } from './types';

export const CORE_COMMANDS = ['PASS', 'PRIVATE', 'STOP', 'SERIOUS', 'HELP', 'SASS'] as const;
export const LEVEL_THRESHOLDS = [0, 35, 90, 160, 250, 360, 500, 675] as const;

const politicalDimensions = ['authority','legitimacy','state','democracy','economics','property','labor','justice','speech','institutions','borders','social liberty','equality','environment','technology','change'];

export const TERRITORY_DEFINITIONS: TerritoryState[] = [
  { id: 'identity', label: 'Identity', status: 'discovered', requiredDimensions: ['self-description','temperament','strengths','vulnerabilities'], coveredDimensions: [], evidenceIds: [] },
  { id: 'values', label: 'Values', status: 'fogged', requiredDimensions: ['moral architecture','loyalty','fairness','autonomy'], coveredDimensions: [], evidenceIds: [] },
  { id: 'politics', label: 'The Republic of Greyson', status: 'fogged', requiredDimensions: politicalDimensions, coveredDimensions: [], evidenceIds: [] },
  { id: 'relationships', label: 'Relationships', status: 'fogged', requiredDimensions: ['attachment','trust','conflict','social world'], coveredDimensions: [], evidenceIds: [] },
  { id: 'interests', label: 'Interests', status: 'fogged', requiredDimensions: ['interests','ordinary preferences','curiosity','motivation'], coveredDimensions: [], evidenceIds: [] },
  { id: 'cognition', label: 'Cognition', status: 'fogged', requiredDimensions: ['decision style','uncertainty','contradiction','revision'], coveredDimensions: [], evidenceIds: [] },
  { id: 'fears', label: 'Fear Map', status: 'fogged', requiredDimensions: ['aversions','fears','risk','boundaries'], coveredDimensions: [], evidenceIds: [] },
  { id: 'future', label: 'Future', status: 'fogged', requiredDimensions: ['hopes','dreams','ideal future','ambition'], coveredDimensions: [], evidenceIds: [] }
];

export const QUEST_DEFINITIONS: QuestState[] = [
  { id: 'first-coordinates', label: 'Find the first coordinates', description: 'Accept three substantive synthetic-map answers.', progress: 0, target: 3, xpBonus: 15, status: 'active' },
  { id: 'chart-first-fragment', label: 'Chart a fragment', description: 'Reach charted status in any territory.', progress: 0, target: 1, xpBonus: 25, status: 'active' }
];

export const UNLOCK_DEFINITIONS: UnlockState[] = [
  { id: 'go-deeper', label: 'Go Deeper', description: 'Ask the Cartographer to pursue the current thread.', levelRequired: 2 },
  { id: 'reroll', label: 'Reroll', description: 'Request a differently framed question.', levelRequired: 3 },
  { id: 'boss-fight', label: 'Boss Fight', description: 'Open a deliberately difficult synthesis encounter.', levelRequired: 5 },
  { id: 'mystery-door', label: 'Mystery Door', description: 'Open a cross-territory question chosen from mapped evidence.', levelRequired: 6 },
  { id: 'turnaround-reveal', label: 'Character Reveal', description: 'Reserve the detailed turnaround art for the Level 8 reveal.', levelRequired: 8 }
];

export const ACHIEVEMENT_DEFINITIONS: AchievementState[] = [
  { id: 'first-mark', label: 'First Mark on the Map', description: 'Accept the first substantive answer.' },
  { id: 'revision-is-data', label: 'Revision Is Data', description: 'Meaningfully revise an earlier position.' },
  { id: 'cartographer', label: 'Cartographer', description: 'Chart the first territory.' },
  { id: 'boss-resolved', label: 'Held the Line', description: 'Resolve a Boss Fight.' },
  { id: 'door-opener', label: 'Door Opener', description: 'Resolve a Mystery Door.' }
];

/**
 * Boss Fights are deterministic, territory-scoped synthesis encounters.
 * `minCoveredDimensions` is the evidence bar the player must already have cleared;
 * a Boss Fight tests mapped material rather than asking for anything new.
 */
export const BOSS_DEFINITIONS: BossDefinition[] = [
  { id: 'boss-identity', territoryId: 'identity', label: 'The Mirror of Identity', description: 'Your mapped temperament and self-description are tested against your vulnerabilities.', levelRequired: 5, minCoveredDimensions: 3, xpReward: 40 },
  { id: 'boss-values', territoryId: 'values', label: 'The Tribunal of Values', description: 'Your mapped values are put against each other under pressure.', levelRequired: 5, minCoveredDimensions: 3, xpReward: 40 },
  { id: 'boss-politics', territoryId: 'politics', label: 'The Republic Under Load', description: 'Your political commitments are forced to pay their own costs.', levelRequired: 5, minCoveredDimensions: 4, xpReward: 60 },
  { id: 'boss-relationships', territoryId: 'relationships', label: 'The Crucible of Trust', description: 'Your mapped bonds, boundaries, and conflict style are put under pressure.', levelRequired: 5, minCoveredDimensions: 3, xpReward: 40 },
  { id: 'boss-interests', territoryId: 'interests', label: 'The Engine of Curiosity', description: 'Your mapped passions, motivations, and attention are weighed against what actually sustains them.', levelRequired: 5, minCoveredDimensions: 3, xpReward: 40 },
  { id: 'boss-cognition', territoryId: 'cognition', label: 'The Revision Court', description: 'Your decision style is tested against your own contradictions.', levelRequired: 5, minCoveredDimensions: 3, xpReward: 40 },
  { id: 'boss-fears', territoryId: 'fears', label: 'The Cost of Avoidance', description: 'Your mapped aversions are weighed against what they protect.', levelRequired: 5, minCoveredDimensions: 3, xpReward: 40 },
  { id: 'boss-future', territoryId: 'future', label: 'The Horizon of Ambition', description: 'Your mapped hopes and ambitions are forced to name what must be sacrificed to reach them.', levelRequired: 5, minCoveredDimensions: 3, xpReward: 40 }
];

/** Fixed deterministic reward for resolving one Mystery Door. */
export const DOOR_XP_REWARD = 20;
/** Minimum active, non-private evidence records required on each side of a Door. */
export const DOOR_MIN_EVIDENCE_PER_TERRITORY = 2;
/** Level at which the Mystery Door move becomes available (mirrors UNLOCK_DEFINITIONS). */
export const DOOR_LEVEL_REQUIRED = 6;
