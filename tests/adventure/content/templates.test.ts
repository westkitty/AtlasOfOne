import { describe, expect, it } from 'vitest';
import { adventureBeatPlan } from '../../../src/adventure/beats';
import { findForbiddenInWorldTerms, parseAdventureTemplate } from '../../../src/adventure/content/templateSchema';
import { CORE_ADVENTURE_TEMPLATES, findAdventureTemplate } from '../../../src/adventure/content/templates';

describe('CT01 12 core adventure template skeletons', () => {
  it('has exactly 12 templates with unique ids and unique kinds', () => {
    expect(CORE_ADVENTURE_TEMPLATES).toHaveLength(12);
    expect(new Set(CORE_ADVENTURE_TEMPLATES.map((t) => t.id)).size).toBe(12);
    expect(new Set(CORE_ADVENTURE_TEMPLATES.map((t) => t.kind)).size).toBe(12);
  });

  it('every template re-parses under the CT00 schema', () => {
    for (const template of CORE_ADVENTURE_TEMPLATES) {
      expect(parseAdventureTemplate(JSON.parse(JSON.stringify(template)))).toEqual(template);
    }
  });

  it('every template has a fun hook, a choice, a withdraw path and memory output', () => {
    for (const template of CORE_ADVENTURE_TEMPLATES) {
      expect(template.funHook.length).toBeGreaterThan(10);
      expect(template.beats.map((b) => b.beat)).toEqual(adventureBeatPlan(template));
      expect(template.beats.find((b) => b.beat === 'choice-consequence')?.intent).toBeTruthy();
      expect(Object.keys(template.failForward).sort()).toEqual(['chose-to-leave', 'escaped', 'overpowered', 'paused-for-later']);
      expect(template.memoryOutputs.length).toBeGreaterThan(0);
    }
  });

  it('contains no psychological labels anywhere in its serialized content', () => {
    for (const template of CORE_ADVENTURE_TEMPLATES) {
      const inWorld = [template.title, template.funHook, ...template.beats.map((b) => b.intent), ...Object.values(template.failForward)];
      for (const text of inWorld) expect(findForbiddenInWorldTerms(text)).toEqual([]);
    }
  });

  it('is fun even if nothing is learned: learningTarget none templates never target gaps or ask for reflection', () => {
    const none = CORE_ADVENTURE_TEMPLATES.filter((t) => t.learningTarget === 'none');
    expect(none.length).toBeGreaterThan(0);
    for (const template of none) {
      expect(template.optionalKnowledgeGapTarget).toBe(false);
      expect(template.beats.map((b) => b.beat)).not.toContain('optional-reflection');
    }
  });

  it('is frozen and looks up by id', () => {
    expect(Object.isFrozen(CORE_ADVENTURE_TEMPLATES)).toBe(true);
    expect(findAdventureTemplate('goose-hat-heist')?.kind).toBe('pure-fun');
    expect(findAdventureTemplate('nope')).toBeUndefined();
  });
});
