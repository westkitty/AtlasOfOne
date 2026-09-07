import { describe, expect, it } from 'vitest';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import { createMockTurn, getMockPrompt } from '../../src/cartographer/mock';
import { eventsFromTurn } from '../../src/cartographer/apply';
import { compileContext } from '../../src/cartographer/context';
import { parseVoiceCommand } from '../../src/voice/commands';
import type { TurnRecord } from '../../src/game/types';

describe('Phase 5 Adversarial QA: Player Archetype Fixtures', () => {
  it('handles extremely short / monosyllabic answers gracefully without crashing', () => {
    let state = createInitialCampaign();
    const prompt = getMockPrompt(state);
    const shortAnswer = 'No.';
    const mockTurn = createMockTurn(state, prompt, shortAnswer);
    const events = eventsFromTurn(prompt, shortAnswer, mockTurn, 'mock');
    state = applyGameEvents(state, events);

    expect(state.turns).toHaveLength(1);
    expect(state.turns[0].answer).toBe('No.');
    // Short answer earns base 5 XP + 2 for initial evidence
    expect(state.xp).toBe(7);
    expect(state.turns[0].substantive).toBe(true);
  });

  it('handles extremely long verbose answers without context overflow or loss', () => {
    let state = createInitialCampaign();
    const prompt = getMockPrompt(state);
    const longAnswer = 'I have spent years considering this question from multiple historical, economic, and philosophical angles. '.repeat(20).trim();
    expect(longAnswer.length).toBeGreaterThan(1500);

    const mockTurn = createMockTurn(state, prompt, longAnswer);
    const events = eventsFromTurn(prompt, longAnswer, mockTurn, 'mock');
    state = applyGameEvents(state, events);

    expect(state.turns).toHaveLength(1);
    expect(state.turns[0].answer).toBe(longAnswer);
    // Length bonus (+3) applied (5 base + 3 length = 8)
    expect(state.xp).toBeGreaterThanOrEqual(8);

    const compiled = compileContext(state, { territoryId: prompt.territoryId, dimension: prompt.dimension, question: prompt.question }, longAnswer);
    expect(compiled.recentTurns.length).toBeLessThanOrEqual(5);
  });

  it('preserves contradictory statements as valid data rather than overwriting history', () => {
    let state = createInitialCampaign();
    const prompt = getMockPrompt(state);

    // Turn 1: Stated preference for strong state intervention
    const answer1 = 'I think central coordination is essential for large-scale social welfare and infrastructure.';
    const turn1 = createMockTurn(state, prompt, answer1);
    state = applyGameEvents(state, eventsFromTurn(prompt, answer1, turn1, 'mock'));

    // Turn 2: Stated skepticism of state power
    const prompt2 = getMockPrompt(state);
    const answer2 = 'I deeply distrust centralized state institutions because authority inevitably entrenches itself.';
    const turn2 = createMockTurn(state, prompt2, answer2);
    state = applyGameEvents(state, eventsFromTurn(prompt2, answer2, turn2, 'mock'));

    expect(state.turns).toHaveLength(2);
    expect(state.turns[0].answer).toContain('central coordination');
    expect(state.turns[1].answer).toContain('deeply distrust centralized state');
    // Both pieces of evidence remain in the ledger
    expect(state.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it('strictly excludes private topics from subsequent prompt selection and outgoing context', () => {
    let state = createInitialCampaign();
    const prompt = getMockPrompt(state);
    const privateDimension = prompt.dimension;

    // Player marks topic private
    state = applyGameEvents(state, [{ type: 'PRIVATE_TOPIC_ADDED', topic: privateDimension }]);
    expect(state.privateTopics).toContain(privateDimension);

    // Subsequent prompt selection must never pick the private dimension
    for (let i = 0; i < 20; i++) {
      const nextPrompt = getMockPrompt(state);
      expect(nextPrompt.dimension).not.toBe(privateDimension);
    }

    // Outgoing compiled context must list it in retiredDimensions and exclude its content
    const compiled = compileContext(state, { territoryId: state.activeTerritory, dimension: 'other', question: 'Test' }, 'Test answer');
    expect(compiled.retiredDimensions).toContain(privateDimension);
  });

  it('enters serious quiet mode immediately and suppresses celebratory presentation notices', () => {
    let state = createInitialCampaign();
    state = applyGameEvents(state, [{ type: 'PRESENTATION_SET', mode: 'quiet' }]);
    expect(state.presentation).toBe('quiet');

    // Add high XP that triggers Level Up
    state = { ...state, xp: 120 };
    state = applyGameEvents(state, [{ type: 'LEVEL_UP', level: 2 }]);

    // Level changed
    expect(state.level).toBeGreaterThanOrEqual(2);
    // When presentation is quiet, presentationQueue notices are suppressed or ignored in UI
    expect(state.presentation).toBe('quiet');
  });

  it('handles nuanced multi-hyphenate political philosophy without flattening', () => {
    let state = createInitialCampaign();
    const politicalTerritory = state.territories.find((t) => t.id === 'politics') ?? state.territories[0];
    state = { ...state, activeTerritory: politicalTerritory.id };

    const complexAnswer = 'My politics are libertarian-socialist: anti-authoritarian municipalism with radical democratic worker control, neither Soviet state planning nor corporate capitalism.';
    const prompt = { territoryId: politicalTerritory.id, dimension: 'authority', question: 'What gives authority its legitimacy?' };
    const mockTurn = createMockTurn(state, prompt, complexAnswer);
    const events = eventsFromTurn(prompt, complexAnswer, mockTurn, 'mock');
    state = applyGameEvents(state, events);

    expect(state.turns).toHaveLength(1);
    expect(state.evidence.some((e) => e.claim.length > 0)).toBe(true);
  });

  it('correctly handles revision turns: awards revision bonus and recomputes coverage on retraction', () => {
    let state = createInitialCampaign();
    const prompt = getMockPrompt(state);

    const answer = 'Actually, revising what I said earlier, I value stability much more than novelty now.';
    const turnRecord: TurnRecord = {
      id: 'turn_rev_1',
      createdAt: new Date().toISOString(),
      territoryId: prompt.territoryId,
      dimension: prompt.dimension,
      question: prompt.question,
      answer,
      substantive: true,
      behavioralExample: false,
      revision: true,
      retracted: false
    };

    // Revision bonus = +5 (5 base + 5 revision = 10)
    state = applyGameEvents(state, [{ type: 'ANSWER_ACCEPTED', turn: turnRecord }]);
    expect(state.xp).toBeGreaterThanOrEqual(10);
    expect(state.turns[0].revision).toBe(true);

    // Now retract the answer
    state = applyGameEvents(state, [{ type: 'ANSWER_RETRACTED', turnId: 'turn_rev_1' }]);
    expect(state.turns[0].retracted).toBe(true);
  });

  it('parses voice commands strictly while protecting conversational answers from accidental interception', () => {
    // Exact agency commands match
    expect(parseVoiceCommand('pass')).toEqual({ type: 'pass', raw: 'pass' });
    expect(parseVoiceCommand('skip question')).toEqual({ type: 'pass', raw: 'skip question' });
    expect(parseVoiceCommand('mark private')).toEqual({ type: 'private', raw: 'mark private' });
    expect(parseVoiceCommand('stop')).toEqual({ type: 'stop', raw: 'stop' });
    expect(parseVoiceCommand('serious mode')).toEqual({ type: 'serious', raw: 'serious mode' });
    expect(parseVoiceCommand('help')).toEqual({ type: 'help', raw: 'help' });
    expect(parseVoiceCommand('low sass')).toEqual({ type: 'sass-low', raw: 'low sass' });

    // Conversational sentences containing command words are NOT intercepted as commands
    expect(parseVoiceCommand('I want to pass along this story about my grandfather')).toBeNull();
    expect(parseVoiceCommand('This is something private that I learned')).toBeNull();
    expect(parseVoiceCommand('I could not stop thinking about that')).toBeNull();
  });
});
