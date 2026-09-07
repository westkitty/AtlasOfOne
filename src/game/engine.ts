import { ACHIEVEMENT_DEFINITIONS, DOOR_XP_REWARD, LEVEL_THRESHOLDS, QUEST_DEFINITIONS, TERRITORY_DEFINITIONS, UNLOCK_DEFINITIONS } from './data';
import { activeBossRun, activeDoorRun, bossDefinition, currentBossStageIndex, doorCandidate, doorRunIsPresentable, isBossAvailable, planBossStages } from './encounters';
import type { AchievementState, BossRunState, CampaignState, DoorRunState, EvidenceRecord, GameEvent, TerritoryState, TerritoryStatus, UnlockState } from './types';

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
    turns: [], evidence: [], insights: [], contradictions: [], mapFragments: [],
    bossRuns: [], activeBoss: null, doorRuns: [], activeDoor: null, privateTopics: [],
    presentation: 'normal', sessionStatus: 'active', campaignCompleted: false, presentationQueue: [], campaignHistory: [], finalAssessment: null, updatedAt: now()
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
    cartographer: state.territories.some((territory) => territory.status === 'charted' || territory.status === 'deeply-charted'),
    'boss-resolved': state.bossRuns.some((run) => run.status === 'complete'),
    'door-opener': state.doorRuns.some((run) => run.status === 'complete')
  };
  const achievements = state.achievements.map((achievement): AchievementState => achievement.unlockedAt || !predicates[achievement.id] ? achievement : { ...achievement, unlockedAt: now() });
  const notices = [...state.presentationQueue];
  if (level > previous.level) notices.push({ id: uid('notice'), kind: 'level', title: `Level ${level}`, detail: 'A new layer of the Atlas is available.', createdAt: now() });
  unlocks.filter((item) => item.unlockedAt && !previous.unlocks.find((old) => old.id === item.id)?.unlockedAt).forEach((item) => notices.push({ id: uid('notice'), kind: 'unlock', title: item.label, detail: item.description, createdAt: now() }));
  achievements.filter((item) => item.unlockedAt && !previous.achievements.find((old) => old.id === item.id)?.unlockedAt).forEach((item) => notices.push({ id: uid('notice'), kind: 'achievement', title: item.label, detail: item.description, createdAt: now() }));
  return { ...state, level, unlocks, achievements, presentationQueue: notices };
}

/**
 * Encounter answers earn exactly what an ordinary accepted answer earns. There is
 * no bonus for difficulty, vulnerability or painful disclosure anywhere in this file.
 */
function answerXp(turn: { answer: string; behavioralExample: boolean; revision: boolean }) {
  return 5 + (turn.answer.trim().length >= 80 ? 3 : 0) + (turn.behavioralExample ? 3 : 0) + (turn.revision ? 5 : 0);
}

/**
 * A Boss Fight resolves once no stage is still pending. Its fixed reward and its
 * achievement are granted here, by the engine, and by nothing else.
 */
function settleBossRun(state: CampaignState, run: BossRunState): CampaignState {
  if (run.stages.some((stage) => stage.outcome === 'pending')) {
    return { ...state, bossRuns: state.bossRuns.map((item) => item.id === run.id ? run : item) };
  }
  const reward = bossDefinition(run.bossId)?.xpReward ?? 0;
  const completed: BossRunState = { ...run, status: 'complete', completedAt: now() };
  return {
    ...state,
    xp: state.xp + reward,
    bossRuns: state.bossRuns.map((item) => item.id === run.id ? completed : item),
    activeBoss: null
  };
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
    case 'BOSS_STARTED': {
      // Availability and the stage plan are decided here, never by model output.
      if (state.activeBoss || state.activeDoor) break;
      if (!isBossAvailable(state, event.bossId)) break;
      // Resuming a withdrawn run keeps its stage progress rather than restarting it.
      const existing = state.bossRuns.find((item) => item.bossId === event.bossId && item.status === 'active');
      if (existing) { next = { ...state, activeBoss: event.bossId, activeTerritory: existing.territoryId }; break; }
      const stages = planBossStages(state, event.bossId);
      if (!stages.length) break;
      const definition = bossDefinition(event.bossId)!;
      const run: BossRunState = { id: uid('bossrun'), bossId: event.bossId, territoryId: definition.territoryId, stages, status: 'active', startedAt: now() };
      next = { ...state, bossRuns: [...state.bossRuns, run], activeBoss: event.bossId, activeTerritory: definition.territoryId };
      break;
    }
    case 'BOSS_STAGE_ANSWERED': {
      const run = activeBossRun(state);
      const index = currentBossStageIndex(run);
      if (!run || index < 0) break;
      if (state.sessionStatus === 'paused') break;
      const stages = run.stages.map((stage, position) => position === index ? { ...stage, outcome: 'answered' as const } : stage);
      const advanced = { ...state, xp: state.xp + answerXp(event.turn), turns: [...state.turns, event.turn] };
      next = settleBossRun(advanced, { ...run, stages });
      break;
    }
    case 'BOSS_STAGE_PASSED': {
      // PASS costs nothing and always advances, so a Boss Fight can never trap the player.
      const run = activeBossRun(state);
      const index = currentBossStageIndex(run);
      if (!run || index < 0) break;
      const stages = run.stages.map((stage, position) => position === index ? { ...stage, outcome: 'passed' as const } : stage);
      next = settleBossRun(state, { ...run, stages });
      break;
    }
    case 'BOSS_WITHDRAWN': next = { ...state, activeBoss: null }; break;
    case 'DOOR_OPENED': {
      if (state.activeBoss || state.activeDoor) break;
      const candidate = doorCandidate(state, event.doorId);
      if (!candidate) break;
      const run: DoorRunState = { id: uid('doorrun'), doorId: candidate.doorId, territoryIds: candidate.territoryIds, evidenceIds: candidate.evidenceIds, dimensions: candidate.dimensions, status: 'open', openedAt: now() };
      next = { ...state, doorRuns: [...state.doorRuns, run], activeDoor: candidate.doorId };
      break;
    }
    case 'DOOR_ANSWERED': {
      const run = activeDoorRun(state);
      if (!run) break;
      if (state.sessionStatus === 'paused') break;
      next = {
        ...state,
        xp: state.xp + answerXp(event.turn) + DOOR_XP_REWARD,
        turns: [...state.turns, event.turn],
        insights: state.insights.some((item) => item.id === event.insight.id) ? state.insights : [...state.insights, event.insight],
        doorRuns: state.doorRuns.map((item) => item.id === run.id ? { ...item, status: 'complete' as const, completedAt: now() } : item),
        activeDoor: null
      };
      break;
    }
    case 'DOOR_CLOSED': {
      // Leaving a Door discards the unopened run so the pairing stays available later.
      const run = activeDoorRun(state);
      next = { ...state, activeDoor: null, doorRuns: run ? state.doorRuns.filter((item) => item.id !== run.id) : state.doorRuns };
      break;
    }
    case 'INSIGHT_ADDED': if (!state.insights.some((item) => item.id === event.insight.id)) next = { ...state, insights: [...state.insights, event.insight] }; break;
    case 'INSIGHT_CONFIRMED': next = { ...state, insights: state.insights.map((item) => item.id === event.insightId ? { ...item, status: 'confirmed' } : item) }; break;
    case 'INSIGHT_REJECTED': next = { ...state, insights: state.insights.map((item) => item.id === event.insightId ? { ...item, status: 'rejected' } : item) }; break;
    case 'ANSWER_RETRACTED': {
      const retracted = { ...state, turns: state.turns.map((item) => item.id === event.turnId ? { ...item, retracted: true } : item), evidence: state.evidence.map((item) => item.sourceTurnIds.includes(event.turnId) ? { ...item, status: 'retracted' as const } : item) };
      const doorRuns = retracted.doorRuns.filter((run) => run.status === 'complete' || doorRunIsPresentable(retracted, run));
      next = { ...retracted, doorRuns, activeDoor: doorRuns.some((run) => run.doorId === retracted.activeDoor && run.status === 'open') ? retracted.activeDoor : null };
      break;
    }
    case 'PRIVATE_TOPIC_ADDED': {
      // Marking a topic private retires any unresolved encounter built on it, so
      // private material cannot resurface through a Boss stage or a Mystery Door.
      const privateTopics = unique([...state.privateTopics, event.topic]);
      const scrubbed = { ...state, privateTopics };
      const doorRuns = scrubbed.doorRuns.filter((run) => run.status === 'complete' || doorRunIsPresentable(scrubbed, run));
      const bossRuns = scrubbed.bossRuns.map((run) => run.status !== 'active' ? run : { ...run, stages: run.stages.map((stage) => stage.outcome === 'pending' && stage.dimensions.includes(event.topic) ? { ...stage, outcome: 'private' as const } : stage) });
      const withRuns = { ...scrubbed, doorRuns, bossRuns, activeDoor: doorRuns.some((run) => run.doorId === state.activeDoor && run.status === 'open') ? state.activeDoor : null };
      const boss = withRuns.bossRuns.find((run) => run.bossId === withRuns.activeBoss && run.status === 'active');
      next = boss ? settleBossRun(withRuns, boss) : withRuns;
      break;
    }
    case 'PRESENTATION_SET': next = { ...state, presentation: event.mode }; break;
    case 'SESSION_SET': next = { ...state, sessionStatus: event.status }; break;
    case 'SASS_SET': next = { ...state, settings: { ...state.settings, sass: event.sass } }; break;
    case 'ACTIVE_TERRITORY_SET': if (state.territories.some((item) => item.id === event.territoryId)) next = { ...state, activeTerritory: event.territoryId }; break;
    case 'PRESENTATION_QUEUE_CLEARED': next = { ...state, presentationQueue: [] }; break;
    case 'FINAL_ASSESSMENT_SET': next = { ...state, finalAssessment: event.assessment }; break;
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
