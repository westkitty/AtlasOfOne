import { describe, expect, it } from 'vitest';
import {
  MAX_CONTACT_RADIUS,
  detectEncounterContact,
  transitionEncounterEntity,
  type EncounterEntity
} from '../../src/world/encounterContact';

const entity = (id: string, over: Partial<EncounterEntity> = {}): EncounterEntity => ({
  id, combatDefinitionId: `def_${id}`, territoryId: 'fears', hostility: 'hostile',
  state: 'roaming', position: { x: 100, y: 100 }, contactRadius: 10, ...over
});

describe('W03 encounter contact contract', () => {
  it('no contact outside radius', () => {
    expect(detectEncounterContact({ x: 120, y: 100 }, [entity('a')])).toEqual({ type: 'none' });
  });

  it('hostile roaming contact starts combat with the encounter-owned definition', () => {
    expect(detectEncounterContact({ x: 105, y: 100 }, [entity('a')])).toEqual({
      type: 'start-combat', entityId: 'a', combatDefinitionId: 'def_a'
    });
  });

  it('peaceful contact only offers interaction, never combat', () => {
    expect(detectEncounterContact({ x: 100, y: 100 }, [entity('p', { hostility: 'peaceful' })])).toEqual({
      type: 'offer-interaction', entityId: 'p'
    });
  });

  it('engaged/resolved entities do not retrigger', () => {
    const p = { x: 100, y: 100 };
    expect(detectEncounterContact(p, [entity('a', { state: 'engaged' })]).type).toBe('none');
    expect(detectEncounterContact(p, [entity('a', { state: 'resolved' })]).type).toBe('none');
  });

  it('nearest wins; ties break by id regardless of order', () => {
    const near = entity('z', { position: { x: 102, y: 100 } });
    const far = entity('a', { position: { x: 107, y: 100 } });
    expect(detectEncounterContact({ x: 100, y: 100 }, [far, near])).toMatchObject({ entityId: 'z' });
    const t1 = entity('b', { position: { x: 103, y: 100 } });
    const t2 = entity('a', { position: { x: 97, y: 100 } });
    expect(detectEncounterContact({ x: 100, y: 100 }, [t1, t2])).toMatchObject({ entityId: 'a' });
    expect(detectEncounterContact({ x: 100, y: 100 }, [t2, t1])).toMatchObject({ entityId: 'a' });
  });

  it('fails closed on invalid coordinates, huge radii and missing definitions', () => {
    expect(detectEncounterContact({ x: NaN, y: 0 }, [entity('a')]).type).toBe('none');
    expect(detectEncounterContact({ x: 100, y: 100 }, [entity('a', { position: { x: Infinity, y: 100 } })]).type).toBe('none');
    const huge = entity('a', { contactRadius: 10_000 });
    expect(detectEncounterContact({ x: 100 + MAX_CONTACT_RADIUS + 1, y: 100 }, [huge]).type).toBe('none');
    expect(detectEncounterContact({ x: 100, y: 100 }, [entity('a', { combatDefinitionId: ' ' })]).type).toBe('none');
    expect(detectEncounterContact({ x: 100, y: 100 }, [entity('a', { contactRadius: NaN })]).type).toBe('start-combat');
  });

  it('entity lifecycle is roaming -> engaged -> resolved only', () => {
    const engaged = transitionEncounterEntity(entity('a'), 'engaged');
    expect(transitionEncounterEntity(engaged, 'resolved').state).toBe('resolved');
    expect(() => transitionEncounterEntity(entity('a'), 'resolved')).toThrow();
    expect(() => transitionEncounterEntity(engaged, 'roaming')).toThrow();
  });
});
