import { ACHIEVEMENT_DEFINITIONS, LEVEL_THRESHOLDS, QUEST_DEFINITIONS, TERRITORY_DEFINITIONS, UNLOCK_DEFINITIONS } from './data';
import type { AchievementState, CampaignState, EvidenceRecord, GameEvent, TerritoryState, TerritoryStatus, UnlockState } from './types';

const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}_${crypto.randomUUID()}`;
const unique = <T,>(items: T[]) => [...new Set(items)];

export function createInitialCampaign(): CampaignState {
  return {
    schemaVersion: 1,
    campaignId: uid('campaign'),
    player: { id: 'greyson', displayName: 'Greyson', pronouns: 'he/they' },
    settings: { sass: 'medium', reducedMotion: false, voiceMode: 'text' },
    xp: 0,
    level: 1,
    territories: structuredClone(TERRITORY_DEFINITIONS),
    quests: structuredClone(QUEST_DEFINITIONS),
    achievements: structuredClone(ACHIEVEMENT_DEFINITIONS),
    unlocks: structuredClone(UNLOCK_DEFINITIONS),
    activeTerritory: 'identity',
    activeQuest: 'first-coordinates',
    turns: [], evidence: [], insights: [], contradictions: [], mapFragments: [], privateTopics: [],
    presentation: 'normal', sessionStatus: 'active', campaignCompleted: false, presentationQueue: [], campaignHistory: [], updatedAt: now()
  };
}

export function levelForXp(xp: number): number {
  let level = 1;
  LEVEL_THRESHOLDS.forEach((threshold, index) => { if (xp >= threshold) level = index + 1; });
  return Math.min(8, level);
}

export function territoryStatusForCoverage(covered: number, total: number): TerritoryStatus {
  if (covered <= 0 || total <= 0) return 'fogged';
  const ratio = covered / total;
  if (ratio < .25) return 'discovered';
  if (ratio < .5) return 'exploring';
  if (ratio < 1) return 'charted';
  return 'deeply-charted';
}

export function xpIntoCurrentLevel(state: CampaignState) {
  const floor = LEVEL_THRESHOLDS[state.level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[state.level] ?? state.xp;
  return { current: Math.max(0, state.xp - floor), required: state.level >= 8 ? Math.max(1, state.xp - floor) : next - floor };
}

function history(state: CampaignState, event: GameEvent): CampaignState {
  return { ...state, updatedAt: now(), campaignHistory: [...state.campaignHistory, { id: uid('event'), type: event.type, at: now() }] };
}

function reconcileTerritories(state: CampaignState): CampaignState {
  const active = state.evidence.filter((item) => item.status === 'active');
  let fragments = [...state.mapFragments];
  let quests = [...state.quests];
  let xp = state.xp;
  const territories = state.territories.map((territory): TerritoryState => {
    const evidence = active.filter((item) => item.territories.includes(territory.id));
    const coveredDimensions = unique(evidence.map((item) => item.dimension).filter((dimension) => territory.requiredDimensions.includes(dimension)));
    const status = territoryStatusForCoverage(coveredDimensions.length, territory.requiredDimensions.length);
    if ((status === 'charted' || status === 'deeply-charted') && !fragments.some((fragment) => fragment.territoryId === territory.id)) {
      fragments.push({ id: `fragment_${territory.id}`, territoryId: territory.id, label: `${territory.label} Fragment`, unlockedAt: now() });
      const quest = quests.find((item) => item.id === 'chart-first-fragment' && item.status === 'active');
      if (quest) {
        quests = quests.map((item) => item.id === quest.id ? { ...item, progress: item.target, status: 'complete' } : item);
        xp += quest.xpBonus;
      }
    }
    return { ...territory, status, coveredDimensions, evidenceIds: unique(evidence.map((item) => item.id)) };
  });
  return { ...state, territories, mapFragments: fragments, quests, xp };
}

function reconcileProgression(state: CampaignState, previous: CampaignState): CampaignState {
  const level = levelForXp(state.xp);
  const unlocks = state.unlocks.map((unlock): UnlockState => unlock.unlockedAt || unlock.levelRequired > level ? unlock : { ...unlock, unlockedAt: now() });
  const predicates: Record<string, boolean> = {
    'first-mark': state.turns.some((turn) => turn.substantive && !turn.retracted),
    'revision-is-data': state.turns.some((turn) => turn.revision && !turn.retracted),
    cartographer: state.territories.some((territory) => territory.status === 'charted' || territory.status === 'deeply-charted')
  };
  const achievements = state.achievements.map((achievement): AchievementState => achievement.unlockedAt || !predicates[achievement.id] ? achievement : { ...achievement, unlockedAt: now() });
  const notices = [...state.presentationQueue];
  if (level > previous.level) notices.push({ id: uid('notice'), kind: 'level', title: `Level ${level}`, detail: 'A new layer of the Atlas is available.', createdAt: now() });
  unlocks.filter((item) => item.unlockedAt && !previous.unlocks.find((old) => old.id === item.id)?.unlockedAt).forEach((item) => notices.push({ id: uid('notice'), kind: 'unlock', title: item.label, detail: item.description, createdAt: now() }));
  achievements.filter((item) => item.unlockedAt && !previous.achievements.find((old) => old.id === item.id)?.unlockedAt).forEach((item) => notices.push({ id: uid('notice'), kind: 'achievement', title: item.label, detail: item.description, createdAt: now() }));
  return { ...state, level, unlocks, achievements, presentationQueue: notices };
}

function evidenceXp(state: CampaignState, evidence: EvidenceRecord) {
  return state.evidence.some((item) => item.status === 'active' && item.dimension === evidence.dimension && item.claim === evidence.claim) ? 0 : 2;
}

export function applyGameEvent(state: CampaignState, event: GameEvent): CampaignState {
  const previous = state;
  let next = state;
  switch (event.type) {
    case 'ANSWER_ACCEPTED': {
      const turn = event.turn;
      const gained = 5 + (turn.answer.trim().length >= 80 ? 3 : 0) + (turn.behavioralExample ? 3 : 0) + (turn.revision ? 5 : 0);
      let quests = state.quests;
      let activeQuest = state.activeQuest;
      let xp = state.xp + gained;
      if (turn.substantive && activeQuest) {
        const quest = quests.find((item) => item.id === activeQuest && item.status === 'active');
        if (quest) {
          const progress = Math.min(quest.target, quest.progress + 1);
          const complete = progress >= quest.target;
          quests = quests.map((item) => item.id === quest.id ? { ...item, progress, status: complete ? 'complete' : 'active' } : item);
          if (complete) { xp += quest.xpBonus; activeQuest = quests.find((item) => item.status === 'active')?.id ?? null; }
        }
      }
      next = { ...state, xp, quests, activeQuest, turns: [...state.turns, turn] };
      break;
    }
    case 'EVIDENCE_ADDED': next = { ...state, xp: state.xp + evidenceXp(state, event.evidence), evidence: [...state.evidence, event.evidence] }; break;
    case 'QUEST_PROGRESS': next = { ...state, quests: state.quests.map((q) => q.id === event.questId && q.status === 'active' ? { ...q, progress: Math.min(q.target, q.progress + Math.max(0, event.amount)) } : q) }; break;
    case 'QUEST_COMPLETE': { const q = state.quests.find((item) => item.id === event.questId && item.status === 'active'); if (q) next = { ...state, xp: state.xp + q.xpBonus, quests: state.quests.map((item) => item.id === q.id ? { ...item, progress: item.target, status: 'complete' } : item) }; break; }
    case 'MAP_FRAGMENT_UNLOCKED': if (!state.mapFragments.some((item) => item.id === event.fragment.id)) next = { ...state, mapFragments: [...state.mapFragments, event.fragment] }; break;
    case 'INSIGHT_ADDED': if (!state.insights.some((item) => item.id === event.insight.id)) next = { ...state, insights: [...state.insights, event.insight] }; break;
    case 'INSIGHT_CONFIRMED': next = { ...state, insights: state.insights.map((item) => item.id === event.insightId ? { ...item, status: 'confirmed' } : item) }; break;
    case 'INSIGHT_REJECTED': next = { ...state, insights: state.insights.map((item) => item.id === event.insightId ? { ...item, status: 'rejected' } : item) }; break;
    case 'ANSWER_RETRACTED': next = { ...state, turns: state.turns.map((item) => item.id === event.turnId ? { ...item, retracted: true } : item), evidence: state.evidence.map((item) => item.sourceTurnIds.includes(event.turnId) ? { ...item, status: 'retracted' } : item) }; break;
    case 'PRIVATE_TOPIC_ADDED': next = { ...state, privateTopics: unique([...state.privateTopics, event.topic]) }; break;
    case 'PRESENTATION_SET': next = { ...state, presentation: event.mode }; break;
    case 'SESSION_SET': next = { ...state, sessionStatus: event.status }; break;
    case 'SASS_SET': next = { ...state, settings: { ...state.settings, sass: event.sass } }; break;
    case 'ACTIVE_TERRITORY_SET': if (state.territories.some((item) => item.id === event.territoryId)) next = { ...state, activeTerritory: event.territoryId }; break;
    case 'PRESENTATION_QUEUE_CLEARED': next = { ...state, presentationQueue: [] }; break;
    case 'CAMPAIGN_COMPLETED': next = { ...state, campaignCompleted: true }; break;
    case 'TERRITORY_ADVANCED':
    case 'LEVEL_UP':
    case 'ABILITY_UNLOCKED':
    case 'ACHIEVEMENT_UNLOCKED':
      next = state; break;
  }
  next = reconcileTerritories(next);
  next = reconcileProgression(next, previous);
  return history(next, event);
}

export const applyGameEvents = (state: CampaignState, events: GameEvent[]) => events.reduce(applyGameEvent, state);
