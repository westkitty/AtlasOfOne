import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { AdventureKind } from '../../src/contracts/adventure';
import {
  createWorldMarkerRenderModel,
  markerKindForAdventureKind,
  markerKindForInteractableType,
  WORLD_MARKER_DEFINITIONS,
  WORLD_MARKER_KINDS,
  WorldMarkerIcon,
  worldMarkerDefinition,
  worldMarkerId
} from '../../src/world/markers';

const ALL_ADVENTURE_KINDS: AdventureKind[] = [
  'social-dilemma',
  'investigation',
  'rescue-support',
  'exploration-expedition',
  'negotiation',
  'absurd-comedy-problem',
  'ethical-conflict',
  'creative-building-challenge',
  'memory-echo',
  'relationship-companion-scene',
  'mystery-puzzle',
  'survival-escape',
  'combat-forward-story',
  'pure-fun-wildcard'
];

const FORBIDDEN_ANALYTIC_COPY = /gap|priority|trait|loyalty|authority|diagnos|evidence|private|contradiction|underexplored|curiosity|change over time/i;

describe('W01 Worldwalker marker taxonomy', () => {
  it('freezes the ten public marker categories with unique non-color glyph identity', () => {
    expect(WORLD_MARKER_KINDS).toEqual([
      'adventure',
      'journal-shrine',
      'npc-conversation',
      'encounter',
      'mystery-door',
      'boss-arena',
      'memory',
      'discovery',
      'sanctuary',
      'pure-fun'
    ]);

    const definitions = WORLD_MARKER_KINDS.map((kind) => WORLD_MARKER_DEFINITIONS[kind]);
    expect(new Set(definitions.map((definition) => definition.kind)).size).toBe(definitions.length);
    expect(new Set(definitions.map((definition) => definition.glyph)).size).toBe(definitions.length);
    expect(new Set(definitions.map((definition) => definition.label)).size).toBe(definitions.length);
    for (const definition of definitions) {
      expect(definition.glyph.trim().length).toBeGreaterThan(0);
      expect(definition.ariaLabel.trim().length).toBeGreaterThan(0);
      expect(definition).not.toHaveProperty('color');
      expect(`${definition.label} ${definition.ariaLabel}`).not.toMatch(FORBIDDEN_ANALYTIC_COPY);
    }
  });

  it('collapses all analysis-linked Adventure kinds to one public Adventure marker', () => {
    for (const kind of ALL_ADVENTURE_KINDS) {
      expect(markerKindForAdventureKind(kind)).toBe(kind === 'pure-fun-wildcard' ? 'pure-fun' : 'adventure');
    }
    expect(markerKindForAdventureKind('contradiction')).toBeNull();
    expect(markerKindForAdventureKind('')).toBeNull();
    expect(markerKindForAdventureKind(null)).toBeNull();
  });

  it('keeps existing Worldwalker interactable categories distinct without inventing placement', () => {
    expect(markerKindForInteractableType('landmark')).toBe('sanctuary');
    expect(markerKindForInteractableType('door')).toBe('mystery-door');
    expect(markerKindForInteractableType('boss')).toBe('boss-arena');
    expect(markerKindForInteractableType('waystone')).toBe('discovery');
    expect(markerKindForInteractableType('prop')).toBe('discovery');
    expect(markerKindForInteractableType('exit')).toBeNull();
    expect(markerKindForInteractableType('knowledge-gap')).toBeNull();
  });

  it('uses deterministic collision-safe instance IDs and fails malformed input closed', () => {
    expect(worldMarkerId('adventure', 'a-b')).not.toBe(worldMarkerId('adventure', 'a:b'));
    expect(worldMarkerId('adventure', '  seed-1  ')).toBe(worldMarkerId('adventure', 'seed-1'));
    expect(worldMarkerId('adventure', '   ')).toBeNull();
    expect(worldMarkerDefinition('adventure')).toEqual(WORLD_MARKER_DEFINITIONS.adventure);
    expect(worldMarkerDefinition('unknown')).toBeNull();
    expect(createWorldMarkerRenderModel(null)).toBeNull();
    expect(createWorldMarkerRenderModel({ kind: 'unknown', sourceId: 'seed-1' })).toBeNull();
    expect(createWorldMarkerRenderModel({ kind: 'adventure', sourceId: '' })).toBeNull();
  });

  it('compiles only category-safe render metadata and ignores hidden analytic fields', () => {
    const imported = {
      kind: 'adventure',
      sourceId: 'seed-safe',
      gapKind: 'contradiction',
      priority: 999,
      summary: 'HIDDEN_GAP_SUMMARY_CANARY',
      evidenceClaim: 'PRIVATE_EVIDENCE_CANARY',
      privateDimension: 'SECRET_DIMENSION_CANARY',
      traitTarget: 'LOYALTY_TRAIT_CANARY'
    };
    const before = structuredClone(imported);
    const first = createWorldMarkerRenderModel(imported);
    const second = createWorldMarkerRenderModel(imported);

    expect(first).toEqual(second);
    expect(imported).toEqual(before);
    expect(first).toEqual({
      ...WORLD_MARKER_DEFINITIONS.adventure,
      id: worldMarkerId('adventure', 'seed-safe'),
      testId: 'world-marker-adventure'
    });
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain('HIDDEN_GAP_SUMMARY_CANARY');
    expect(serialized).not.toContain('PRIVATE_EVIDENCE_CANARY');
    expect(serialized).not.toContain('SECRET_DIMENSION_CANARY');
    expect(serialized).not.toContain('LOYALTY_TRAIT_CANARY');
    expect(serialized).not.toContain('contradiction');
    expect(serialized).not.toContain('999');
  });

  it('renders semantic icon markup with glyph + accessible category name and no color dependency', () => {
    const model = createWorldMarkerRenderModel({ kind: 'pure-fun', sourceId: 'seed-fun' });
    expect(model).not.toBeNull();
    const markup = renderToStaticMarkup(WorldMarkerIcon({ model: model! }));

    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Pure fun event"');
    expect(markup).toContain('data-marker-kind="pure-fun"');
    expect(markup).toContain('data-testid="world-marker-pure-fun"');
    expect(markup).toContain('★');
    expect(markup).not.toContain('style=');
    expect(markup).not.toMatch(FORBIDDEN_ANALYTIC_COPY);
  });
});
