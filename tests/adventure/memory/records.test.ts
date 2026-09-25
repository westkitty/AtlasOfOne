import { describe, expect, it } from 'vitest';
import {
  ADVENTURE_MEMORY_MAX_TRIGGER_TERMS,
  ADVENTURE_MEMORY_SUMMARY_MAX_LENGTH,
  attachMemoryToRun,
  createAdventureMemory,
  markAdventureMemoryPrivate,
  normalizeTriggerTerms,
  retireAdventureMemory,
  touchAdventureMemory,
  upsertAdventureMemory
} from '../../../src/adventure/memory/records';
import type { AdventureRun } from '../../../src/adventure/schema';
import { mem } from './fixtures';

const base = {
  id: 'mem_a', type: 'place' as const, summary: '  The old mill by the river.  ',
  triggerTerms: ['Mill', ' river ', 'mill'], sourceIds: ['run_2', 'run_1', 'run_1']
};

describe('N00 typed AdventureMemory records', () => {
  it('creates a normalized, active, normal-privacy card', () => {
    expect(createAdventureMemory(base)).toEqual({
      id: 'mem_a', type: 'place', summary: 'The old mill by the river.', triggerTerms: ['mill', 'river'],
      sourceIds: ['run_1', 'run_2'], privacy: 'normal', status: 'active'
    });
  });

  it('requires provenance, id, summary and a valid type', () => {
    expect(() => createAdventureMemory({ ...base, sourceIds: [] })).toThrow(/source/);
    expect(() => createAdventureMemory({ ...base, sourceIds: ['  '] })).toThrow(/source/);
    expect(() => createAdventureMemory({ ...base, id: ' ' })).toThrow();
    expect(() => createAdventureMemory({ ...base, summary: '   ' })).toThrow();
    expect(() => createAdventureMemory({ ...base, type: 'feeling' as never })).toThrow();
  });

  it('bounds summary and trigger terms', () => {
    expect(() => createAdventureMemory({ ...base, summary: 'x'.repeat(ADVENTURE_MEMORY_SUMMARY_MAX_LENGTH + 1) })).toThrow();
    const many = Array.from({ length: ADVENTURE_MEMORY_MAX_TRIGGER_TERMS + 1 }, (_, i) => `t${i}`);
    expect(() => normalizeTriggerTerms(many)).toThrow();
    expect(() => normalizeTriggerTerms(['y'.repeat(41)])).toThrow();
    expect(normalizeTriggerTerms(['  Old   Mill ', '', 'old mill'])).toEqual(['old mill']);
  });

  it('touch is monotonic and refuses retired cards', () => {
    const card = touchAdventureMemory(mem(), '2026-02-01T00:00:00.000Z');
    expect(card.lastUsedAt).toBe('2026-02-01T00:00:00.000Z');
    expect(touchAdventureMemory(card, '2026-01-01T00:00:00.000Z')).toBe(card);
    expect(() => touchAdventureMemory(card, 'nope')).toThrow();
    expect(() => touchAdventureMemory(retireAdventureMemory(card), '2026-03-01T00:00:00.000Z')).toThrow();
  });

  it('retire/private are idempotent and preserve the record', () => {
    const retired = retireAdventureMemory(mem());
    expect(retired).toMatchObject({ id: 'mem_1', status: 'retired', summary: mem().summary });
    expect(retireAdventureMemory(retired)).toBe(retired);
    const priv = markAdventureMemoryPrivate(mem());
    expect(priv.privacy).toBe('private');
    expect(markAdventureMemoryPrivate(priv)).toBe(priv);
  });

  it('attaches memory ids to runs and upserts by id deterministically', () => {
    const run = { id: 'run_1', memoryIds: ['mem_z'] } as unknown as AdventureRun;
    expect(attachMemoryToRun(run, 'mem_a').memoryIds).toEqual(['mem_a', 'mem_z']);
    expect(attachMemoryToRun(run, 'mem_z')).toBe(run);
    expect(() => attachMemoryToRun(run, '')).toThrow();
    const list = upsertAdventureMemory([mem({ id: 'b' }), mem({ id: 'a' })], mem({ id: 'b', summary: 'new' }));
    expect(list.map((m) => [m.id, m.summary])).toEqual([['a', mem().summary], ['b', 'new']]);
    expect(() => upsertAdventureMemory([], { ...mem(), status: 'bogus' } as never)).toThrow();
  });
});
