import { describe, expect, it } from 'vitest';
import { continuityDigest, objectsAtPlace, relevantContinuity, resolvePromise } from '../../../src/adventure/memory/continuity';
import { asGated, gatedMem } from './fixtures';

const bank = [
  gatedMem({ id: 'promise_lamp', type: 'promise', summary: 'Promised to return the lamp to Pell.', triggerTerms: ['lamp', 'pell'] }),
  gatedMem({ id: 'promise_old', type: 'promise', summary: 'Kept promise.', triggerTerms: ['bridge'], status: 'retired' }),
  gatedMem({ id: 'obj_lamp', type: 'object', summary: 'A brass lamp.', triggerTerms: ['lamp', 'old mill'] }),
  gatedMem({ id: 'obj_key', type: 'object', summary: 'A tiny key.', triggerTerms: ['key'], sourceIds: ['place_mill'] }),
  gatedMem({ id: 'obj_secret', type: 'object', summary: 'Hidden.', triggerTerms: ['old mill'], privacy: 'private' }),
  gatedMem({ id: 'place_mill', type: 'place', summary: 'The old mill.', triggerTerms: ['old mill'] }),
  gatedMem({ id: 'char_pell', type: 'character', summary: 'Pell.', triggerTerms: ['pell'] })
];

describe('N06 promise/object/place continuity', () => {
  it('groups active normal cards by type in stable id order', () => {
    const digest = continuityDigest([...bank].reverse());
    expect(digest.openPromises.map((m) => m.id)).toEqual(['promise_lamp']);
    expect(digest.objects.map((m) => m.id)).toEqual(['obj_key', 'obj_lamp']);
    expect(digest.places.map((m) => m.id)).toEqual(['place_mill']);
  });

  it('surfaces relevant continuity for a scene and excludes other types', () => {
    const relevant = relevantContinuity(bank, { text: 'I bring the lamp back to Pell' });
    expect(relevant.openPromises.map((m) => m.id)).toEqual(['promise_lamp']);
    expect(relevant.objects.map((m) => m.id)).toEqual(['obj_lamp']);
    expect(relevant.places).toEqual([]);
  });

  it('resolving a promise closes it but keeps the history card', () => {
    const resolved = resolvePromise(bank[0]!);
    expect(resolved.status).toBe('retired');
    expect(resolved.summary).toBe(bank[0]!.summary);
    expect(continuityDigest([asGated(resolved)]).openPromises).toEqual([]);
    expect(() => resolvePromise(bank[2]!)).toThrow();
  });

  it('finds objects left at a place by source link or shared term, never private ones', () => {
    expect(objectsAtPlace(bank, bank[5]!).map((m) => m.id)).toEqual(['obj_key', 'obj_lamp']);
    expect(() => objectsAtPlace(bank, bank[2]!)).toThrow();
  });
});
