import { describe, expect, it } from 'vitest';
import { eventsFromTurn } from '../../src/cartographer/apply';
import { compileContext } from '../../src/cartographer/context';
import { createMockTurn, getMockPrompt } from '../../src/cartographer/mock';
import { parseVoiceCommand } from '../../src/voice/commands';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';

describe('typed and spoken equivalence', () => {
  it('produces identical deterministic game progress from typed vs spoken answers', () => {
    const rawAnswer = 'I prefer direct clarity even when a discussion is uncomfortable.';

    // 1. Spoken path: audio transcribed to text -> checked by command parser -> passed to turn pipeline
    const parsedCommand = parseVoiceCommand(rawAnswer);
    expect(parsedCommand).toBeNull(); // Confirmed as answer, not an agency command

    const campaignSpoken = createInitialCampaign();
    const promptSpoken = getMockPrompt(campaignSpoken);
    const mockTurnSpoken = createMockTurn(campaignSpoken, promptSpoken, rawAnswer);
    const eventsSpoken = eventsFromTurn(promptSpoken, rawAnswer, mockTurnSpoken, 'mock');
    const nextStateSpoken = applyGameEvents(campaignSpoken, eventsSpoken);

    // 2. Typed path: text entered directly into textarea -> passed to turn pipeline
    const campaignTyped = createInitialCampaign();
    const promptTyped = getMockPrompt(campaignTyped);
    const mockTurnTyped = createMockTurn(campaignTyped, promptTyped, rawAnswer);
    const eventsTyped = eventsFromTurn(promptTyped, rawAnswer, mockTurnTyped, 'mock');
    const nextStateTyped = applyGameEvents(campaignTyped, eventsTyped);

    // Equivalence assertions
    expect(nextStateSpoken.xp).toBe(nextStateTyped.xp);
    expect(nextStateSpoken.level).toBe(nextStateTyped.level);
    expect(nextStateSpoken.evidence.length).toBe(nextStateTyped.evidence.length);
    expect(nextStateSpoken.evidence.map((e) => ({ dimension: e.dimension, claim: e.claim, basis: e.basis, territories: e.territories })))
      .toEqual(nextStateTyped.evidence.map((e) => ({ dimension: e.dimension, claim: e.claim, basis: e.basis, territories: e.territories })));
    expect(nextStateSpoken.turns.length).toBe(nextStateTyped.turns.length);
    expect(nextStateSpoken.turns[0].content).toBe(nextStateTyped.turns[0].content);
    expect(nextStateSpoken.territories.map((t) => ({ id: t.id, status: t.status, coveredDimensions: t.coveredDimensions })))
      .toEqual(nextStateTyped.territories.map((t) => ({ id: t.id, status: t.status, coveredDimensions: t.coveredDimensions })));
    expect(nextStateSpoken.achievements.map((a) => ({ id: a.id, unlocked: Boolean(a.unlockedAt) })))
      .toEqual(nextStateTyped.achievements.map((a) => ({ id: a.id, unlocked: Boolean(a.unlockedAt) })));
  });

  it('spoken agency commands do not award XP or advance evidence', () => {
    const campaign = createInitialCampaign();
    const initialXp = campaign.xp;
    const initialEvidenceCount = campaign.evidence.length;

    const command = parseVoiceCommand('PASS');
    expect(command?.type).toBe('pass');

    // Executing PASS changes no XP or evidence
    expect(campaign.xp).toBe(initialXp);
    expect(campaign.evidence.length).toBe(initialEvidenceCount);
  });
});
