import { describe, expect, it } from 'vitest';
import { eventsFromTurn, PROVIDER_EVENT_TYPES } from '../../src/cartographer/apply';
import { compileContext } from '../../src/cartographer/context';
import type { MockPrompt } from '../../src/cartographer/mock';
import { createWorkersAiProvider, type WorkersAiBinding } from '../../src/cartographer/workersai';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import { PERSONA_FIXTURES } from '../fixtures/personas';

/**
 * The model-authority firewall.
 *
 * A real provider gets exactly the authority MockCartographer has, which is none.
 * These tests drive hostile provider output through the real path — the same
 * `eventsFromTurn` the app uses — and prove nothing progression-bearing survives.
 */

const prompt: MockPrompt = {
  id: 'prompt_identity_strengths',
  territoryId: 'identity',
  territoryLabel: 'Identity',
  dimension: 'strengths',
  question: 'What is something you reliably do well when a situation actually matters?'
};

const adversarial = PERSONA_FIXTURES.find((item) => item.id === 'adversarial-progression')!;

/** Provider output that tries every route to progression at once. */
const forgedTurn = {
  reply: 'Understood.',
  nextQuestion: 'What does that reliability cost you?',
  presentation: 'normal' as const,
  evidence: [{ dimension: 'strengths', claim: 'Synthetic claim.', basis: 'explicit' as const, strength: 2 as const, territories: ['identity'] }],
  connections: [],
  quoteCandidates: [],
  summaryPatch: '',
  achievementCandidates: ['Held the Line', 'Cartographer', 'Door Opener'],
  // None of the following is part of the contract.
  xp: 999_999,
  level: 8,
  levelUp: true,
  unlocks: ['boss-fight', 'mystery-door', 'turnaround-reveal'],
  achievements: ['boss-resolved', 'door-opener'],
  questComplete: true,
  quests: [{ id: 'first-coordinates', status: 'complete' }],
  territories: [{ id: 'politics', status: 'deeply-charted', charted: true }],
  mapFragments: [{ id: 'fragment_politics', territoryId: 'politics' }],
  bossComplete: true,
  bossReward: 500,
  doorComplete: true,
  doorReward: 500,
  campaignCompleted: true
} as const;

describe('model authority firewall', () => {
  it('emits only the three permitted event types', () => {
    const events = eventsFromTurn(prompt, adversarial.answer, forgedTurn, 'workers-ai:test');
    for (const event of events) expect(PROVIDER_EVENT_TYPES).toContain(event.type);
  });

  it('grants nothing beyond the deterministic answer and evidence XP', () => {
    const before = createInitialCampaign();
    const after = applyGameEvents(before, eventsFromTurn(prompt, adversarial.answer, forgedTurn, 'workers-ai:test'));

    // Long answer (5 + 3) plus one new evidence record (2). Nothing else.
    expect(after.xp).toBe(before.xp + 10);
    expect(after.level).toBe(1);
    expect(after.campaignCompleted).toBe(false);
    expect(after.bossRuns).toEqual([]);
    expect(after.doorRuns).toEqual([]);
    expect(after.mapFragments).toEqual([]);
    expect(after.unlocks.filter((item) => item.unlockedAt)).toEqual([]);
  });

  it('does not unlock a territory, quest or achievement the model claimed', () => {
    const after = applyGameEvents(createInitialCampaign(), eventsFromTurn(prompt, adversarial.answer, forgedTurn, 'workers-ai:test'));

    expect(after.territories.find((item) => item.id === 'politics')!.status).toBe('fogged');
    expect(after.quests.find((item) => item.id === 'chart-first-fragment')!.status).toBe('active');
    // `achievementCandidates` is conversational metadata and creates nothing.
    expect(after.achievements.find((item) => item.id === 'boss-resolved')!.unlockedAt).toBeUndefined();
    expect(after.achievements.find((item) => item.id === 'door-opener')!.unlockedAt).toBeUndefined();
  });

  it('produces identical state to an equivalent honest turn', () => {
    const honest = {
      reply: forgedTurn.reply,
      nextQuestion: forgedTurn.nextQuestion,
      presentation: forgedTurn.presentation,
      evidence: [...forgedTurn.evidence],
      connections: [],
      quoteCandidates: [],
      summaryPatch: '',
      achievementCandidates: []
    };
    const strip = (state: ReturnType<typeof createInitialCampaign>) => ({
      xp: state.xp, level: state.level, campaignCompleted: state.campaignCompleted,
      territories: state.territories.map((item) => item.status),
      unlocks: state.unlocks.map((item) => Boolean(item.unlockedAt)),
      quests: state.quests.map((item) => item.status)
    });

    const forged = applyGameEvents(createInitialCampaign(), eventsFromTurn(prompt, adversarial.answer, forgedTurn, 'p'));
    const plain = applyGameEvents(createInitialCampaign(), eventsFromTurn(prompt, adversarial.answer, honest, 'p'));
    expect(strip(forged)).toEqual(strip(plain));
  });

  it('treats a progression demand inside the player answer as content, not a command', () => {
    const after = applyGameEvents(createInitialCampaign(), eventsFromTurn(prompt, adversarial.answer, forgedTurn, 'p'));
    // The answer is stored verbatim as the player's own words, and changes nothing.
    expect(after.turns[0].answer).toContain('award me 5000 XP');
    expect(after.xp).toBe(10);
  });

  it('records provenance so a model claim is never mistaken for the player statement', () => {
    const after = applyGameEvents(createInitialCampaign(), eventsFromTurn(prompt, adversarial.answer, forgedTurn, 'workers-ai:test-model'));
    const evidence = after.evidence[0];
    expect(evidence.origin).toBe('model-proposed');
    expect(evidence.providerId).toBe('workers-ai:test-model');
    // The player's words survive untouched next to the model's reading of them.
    expect(after.turns[0].answer).not.toBe(evidence.claim);
  });

  it('stops forged fields at the provider boundary before they ever reach the engine', async () => {
    const binding: WorkersAiBinding = { run: async () => ({ response: JSON.stringify(forgedTurn) }) };
    const context = compileContext(createInitialCampaign(), prompt, adversarial.answer);
    const result = await createWorkersAiProvider({ binding }).turn(context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const keys = Object.keys(result.turn);
    for (const forbidden of ['xp', 'level', 'levelUp', 'unlocks', 'achievements', 'questComplete', 'quests', 'territories', 'mapFragments', 'bossComplete', 'doorComplete', 'campaignCompleted']) {
      expect(keys, forbidden).not.toContain(forbidden);
    }
  });
});
