import type { AchievementState, QuestState, TerritoryState, UnlockState } from './types';

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
  { id: 'cartographer', label: 'Cartographer', description: 'Chart the first territory.' }
];
