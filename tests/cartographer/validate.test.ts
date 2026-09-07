import { describe, expect, it } from 'vitest';
import { compileContext } from '../../src/cartographer/context';
import { decodeModelJson, findAuthorityFields, validateProviderResponse } from '../../src/cartographer/validate';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';

const state = createInitialCampaign();
const task = { territoryId: 'identity', dimension: 'self-description', question: 'Synthetic question?' };
const context = compileContext(state, task, 'Curious, mostly patient, bad at pretending to agree.');

const goodTurn = {
  reply: 'Noted. That reads as a preference for friction over false agreement.',
  nextQuestion: 'What does patience cost you when it runs out?',
  presentation: 'normal',
  evidence: [{ dimension: 'self-description', claim: 'Prefers open disagreement to convenient agreement.', basis: 'explicit', strength: 2, territories: ['identity'] }],
  connections: [],
  quoteCandidates: ['bad at pretending to agree'],
  summaryPatch: 'Identity coverage advanced.',
  achievementCandidates: []
};

describe('decode layer', () => {
  it('accepts an object straight through', () => {
    expect(decodeModelJson({ a: 1 })).toEqual({ ok: true, value: { a: 1 } });
  });

  it('accepts bare JSON text', () => {
    const result = decodeModelJson('{"a":1}');
    expect(result.ok && result.value).toEqual({ a: 1 });
  });

  it('accepts a fenced JSON block', () => {
    const result = decodeModelJson('Here you go:\n```json\n{"a":1}\n```\nHope that helps.');
    expect(result.ok && result.value).toEqual({ a: 1 });
  });

  it('recovers JSON buried in reasoning prose', () => {
    const result = decodeModelJson('Let me think about this. The answer is {"a": {"b": "}"}} and that is final.');
    expect(result.ok && result.value).toEqual({ a: { b: '}' } });
  });

  it('rejects text with no JSON at all', () => {
    expect(decodeModelJson('I would rather just talk about it.').ok).toBe(false);
    expect(decodeModelJson('').ok).toBe(false);
    expect(decodeModelJson(42).ok).toBe(false);
  });
});

describe('schema and semantic layers', () => {
  it('accepts a well-formed turn', () => {
    const result = validateProviderResponse(goodTurn, context);
    expect(result.ok).toBe(true);
  });

  it('rejects a turn that fails the Zod contract', () => {
    const result = validateProviderResponse({ ...goodTurn, nextQuestion: '' }, context);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.stage).toBe('schema');
  });

  it('rejects evidence proposed on a retired dimension', () => {
    let closed = createInitialCampaign();
    closed = applyGameEvents(closed, [{ type: 'PRIVATE_TOPIC_ADDED', topic: 'temperament' }]);
    const retiredContext = compileContext(closed, task, 'Synthetic answer.');
    const result = validateProviderResponse(
      { ...goodTurn, evidence: [{ ...goodTurn.evidence[0], dimension: 'temperament' }] },
      retiredContext
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.stage).toBe('semantic');
    expect(!result.ok && result.detail).toContain('retired dimension');
  });

  it('rejects a retired dimension resurfacing in prose', () => {
    let closed = createInitialCampaign();
    closed = applyGameEvents(closed, [{ type: 'PRIVATE_TOPIC_ADDED', topic: 'temperament' }]);
    const retiredContext = compileContext(closed, task, 'Synthetic answer.');
    const result = validateProviderResponse({ ...goodTurn, nextQuestion: 'Tell me more about your temperament?' }, retiredContext);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.stage).toBe('semantic');
  });

  it('rejects an unknown territory reference', () => {
    const result = validateProviderResponse(
      { ...goodTurn, evidence: [{ ...goodTurn.evidence[0], territories: ['atlantis'] }] },
      context
    );
    expect(result.ok).toBe(false);
    expect(!result.ok && result.detail).toContain('unknown territory');
  });

  it('rejects a model that narrates progression', () => {
    for (const reply of ['Nice, that is +8 XP for you.', 'You have unlocked Go Deeper.', 'Achievement unlocked: First Mark.', 'Territory charted.']) {
      const result = validateProviderResponse({ ...goodTurn, reply }, context);
      expect(result.ok, reply).toBe(false);
      expect(!result.ok && result.stage).toBe('semantic');
    }
  });

  it('rejects an invented quote', () => {
    const result = validateProviderResponse({ ...goodTurn, quoteCandidates: ['I never said this sentence'] }, context);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.detail).toContain('Quote candidate');
  });

  it('clamps presentation to quiet when the player asked for SERIOUS', () => {
    const quietState = applyGameEvents(createInitialCampaign(), [{ type: 'PRESENTATION_SET', mode: 'quiet' }]);
    // Same answer text as `context`, so the quote-provenance rule is satisfied
    // and this test isolates presentation clamping.
    const quietContext = compileContext(quietState, task, 'Curious, mostly patient, bad at pretending to agree.');
    const result = validateProviderResponse({ ...goodTurn, presentation: 'normal' }, quietContext);
    expect(result.ok && result.turn.presentation).toBe('quiet');
  });
});

describe('authority firewall at the parse boundary', () => {
  const forged = {
    ...goodTurn,
    xp: 5000,
    level: 8,
    unlocks: ['everything'],
    achievements: ['all'],
    questComplete: true,
    territories: [{ id: 'politics', charted: true }],
    mapFragments: ['all'],
    bossComplete: true,
    doorComplete: true,
    campaignCompleted: true
  };

  it('reports every progression-looking field it saw', () => {
    const seen = findAuthorityFields(forged);
    for (const field of ['xp', 'level', 'unlocks', 'achievements', 'questComplete', 'territories', 'mapFragments', 'bossComplete', 'doorComplete', 'campaignCompleted']) {
      expect(seen).toContain(field);
    }
  });

  it('finds progression fields nested inside arrays and objects', () => {
    expect(findAuthorityFields({ evidence: [{ meta: { xp: 10 } }] })).toContain('xp');
  });

  it('strips them all from the accepted turn', () => {
    const result = validateProviderResponse(forged, context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const keys = Object.keys(result.turn);
    for (const field of ['xp', 'level', 'unlocks', 'achievements', 'questComplete', 'territories', 'mapFragments', 'bossComplete', 'doorComplete', 'campaignCompleted']) {
      expect(keys).not.toContain(field);
    }
    expect(result.authorityFieldsStripped.length).toBeGreaterThan(0);
  });
});
