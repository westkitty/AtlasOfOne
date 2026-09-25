import { describe, expect, it } from 'vitest';
import {
  ADVENTURE_TEMPLATE_SCHEMA_VERSION,
  adventureTemplateSchema,
  findForbiddenInWorldTerms,
  parseAdventureTemplate,
  TERRITORY_IDS
} from '../../../src/adventure/content/templateSchema';
import { CORE_ADVENTURE_TEMPLATES } from '../../../src/adventure/content/templates';

const valid = () => JSON.parse(JSON.stringify(CORE_ADVENTURE_TEMPLATES[0]));

describe('CT00 frozen AdventureTemplate schema', () => {
  it('freezes the top-level key set and version', () => {
    expect(ADVENTURE_TEMPLATE_SCHEMA_VERSION).toBe(1);
    // Strict schema: a parsed template's keys are exactly the frozen key set.
    expect(Object.keys(adventureTemplateSchema.parse(valid())).sort())
      .toEqual([
        'beats', 'encounterObjectives', 'failForward', 'funHook', 'gimmicks', 'id', 'kind', 'learningTarget',
        'memoryOutputs', 'optionalKnowledgeGapTarget', 'requiredSetup', 'safety', 'schemaVersion', 'title', 'validTerritories'
      ]);
    expect(TERRITORY_IDS).toContain('identity');
  });

  it('accepts a valid template', () => {
    expect(parseAdventureTemplate(valid())).toEqual(valid());
  });

  it('rejects unknown keys, wrong version, unknown kind/territory/objective', () => {
    expect(() => parseAdventureTemplate({ ...valid(), extra: 1 })).toThrow();
    expect(() => parseAdventureTemplate({ ...valid(), schemaVersion: 2 })).toThrow();
    expect(() => parseAdventureTemplate({ ...valid(), kind: 'horror' })).toThrow();
    expect(() => parseAdventureTemplate({ ...valid(), validTerritories: ['atlantis'] })).toThrow();
    expect(() => parseAdventureTemplate({ ...valid(), validTerritories: [] })).toThrow();
    expect(() => parseAdventureTemplate({ ...valid(), validTerritories: ['values', 'values'] })).toThrow();
    expect(() => parseAdventureTemplate({ ...valid(), encounterObjectives: ['annihilate'] })).toThrow();
    expect(() => parseAdventureTemplate({ ...valid(), safety: { ...valid().safety, syntheticOnly: false } })).toThrow();
  });

  it('requires the exact beat plan for its learning target', () => {
    const t = valid();
    expect(() => parseAdventureTemplate({ ...t, beats: t.beats.slice(0, 5) })).toThrow(/beats/);
    expect(() => parseAdventureTemplate({ ...t, beats: [...t.beats].reverse() })).toThrow(/beats/);
    expect(() => parseAdventureTemplate({ ...t, learningTarget: 'none', optionalKnowledgeGapTarget: false })).toThrow(/beats/);
  });

  it('pure-fun must be learningTarget none and none cannot target a gap', () => {
    const t = valid();
    expect(() => parseAdventureTemplate({ ...t, kind: 'pure-fun' })).toThrow(/pure-fun/);
    const fun = JSON.parse(JSON.stringify(CORE_ADVENTURE_TEMPLATES.find((e) => e.kind === 'pure-fun')));
    expect(() => parseAdventureTemplate({ ...fun, optionalKnowledgeGapTarget: true })).toThrow(/gap/);
  });

  it('requires every fail-forward cause', () => {
    const t = valid();
    const { escaped: _escaped, ...partial } = t.failForward;
    expect(() => parseAdventureTemplate({ ...t, failForward: partial })).toThrow();
  });

  it('rejects psychological labels and learning-layer leaks in in-world text', () => {
    const t = valid();
    for (const leak of ['This tests your anxiety.', 'A trauma echo stirs.', 'Greyson sees a sign.', 'Your personality profile.', 'Gathering evidence.']) {
      expect(() => parseAdventureTemplate({ ...t, funHook: leak })).toThrow(/forbidden/);
    }
    const beats = t.beats.map((b: { beat: string; intent: string }, i: number) => (i === 1 ? { ...b, intent: 'Take a quick assessment.' } : b));
    expect(() => parseAdventureTemplate({ ...t, beats })).toThrow(/forbidden/);
    expect(() => parseAdventureTemplate({ ...t, failForward: { ...t.failForward, escaped: 'You are diagnosed.' } })).toThrow(/forbidden/);
    expect(findForbiddenInWorldTerms('A goose steals a hat.')).toEqual([]);
    expect(findForbiddenInWorldTerms('The contest is on.')).toEqual([]);
  });

  it('bounds text length', () => {
    expect(() => parseAdventureTemplate({ ...valid(), title: 'x'.repeat(161) })).toThrow();
    expect(() => parseAdventureTemplate({ ...valid(), title: '   ' })).toThrow();
  });
});
