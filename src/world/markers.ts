/**
 * W01 / W09: world opportunity marker taxonomy and icon/render contract.
 *
 * Every marker kind (MASTER_INTEGRATION_PLAN 11.2) has a fixed glyph and a
 * fixed plain-language label, so a marker is distinguishable without colour
 * (W09). Labels describe the fiction only; they never announce what an
 * experience "tests" or "measures" (11.3).
 */

export const WORLD_MARKER_KINDS = [
  'adventure',
  'journal-shrine',
  'npc-conversation',
  'encounter-hostile',
  'encounter-peaceful',
  'mystery-door',
  'boss-arena',
  'memory',
  'discovery',
  'sanctuary',
  'pure-fun'
] as const;
export type WorldMarkerKind = typeof WORLD_MARKER_KINDS[number];

export interface WorldMarkerIcon {
  /** Single text glyph; unique per kind so shape alone identifies it. */
  glyph: string;
  /** Short visible text label; unique per kind. */
  label: string;
}

export const WORLD_MARKER_ICONS: Readonly<Record<WorldMarkerKind, WorldMarkerIcon>> = Object.freeze({
  adventure: { glyph: '✦', label: 'Adventure' },
  'journal-shrine': { glyph: '✎', label: 'Journal shrine' },
  'npc-conversation': { glyph: '☺', label: 'Someone to talk to' },
  'encounter-hostile': { glyph: '⚔', label: 'Hostile encounter' },
  'encounter-peaceful': { glyph: '☮', label: 'Peaceful encounter' },
  'mystery-door': { glyph: '▯', label: 'Mystery Door' },
  'boss-arena': { glyph: '♛', label: 'Boss arena' },
  memory: { glyph: '◈', label: 'Memory' },
  discovery: { glyph: '✧', label: 'Discovery' },
  sanctuary: { glyph: '⌂', label: 'Sanctuary' },
  'pure-fun': { glyph: '♫', label: 'Just for fun' }
});

/**
 * Analytical / psychological vocabulary that must never appear in an
 * in-world label (11.3). Matched case-insensitively as word stems.
 */
export const PSYCHOLOGICAL_LABEL_TERMS = [
  'test', 'measur', 'assess', 'evaluat', 'personality', 'trait', 'loyalty',
  'authority', 'psycholog', 'diagnos', 'profil', 'score', 'knowledge gap', 'evidence',
  'learning target', 'analy', 'belief', 'openness', 'neurotic', 'conscientious',
  'agreeable', 'extravert', 'introvert'
] as const;

export function containsPsychologicalLabel(text: string): boolean {
  const lower = text.toLowerCase();
  return PSYCHOLOGICAL_LABEL_TERMS.some((term) => lower.includes(term));
}

export function isWorldMarkerKind(value: unknown): value is WorldMarkerKind {
  return typeof value === 'string' && (WORLD_MARKER_KINDS as readonly string[]).includes(value);
}

export interface WorldMarkerRender {
  kind: WorldMarkerKind;
  glyph: string;
  label: string;
  /** Screen-reader name: kind label plus optional place name. Never colour-dependent. */
  accessibleName: string;
}

/**
 * Pure render contract for one marker. `placeLabel` is an in-world place name
 * (e.g. a region label). Throws on unknown kinds and on any place label that
 * carries psychological vocabulary, so analytical intent cannot leak onto the map.
 */
export function renderWorldMarker(kind: WorldMarkerKind, placeLabel?: string): WorldMarkerRender {
  if (!isWorldMarkerKind(kind)) throw new Error(`Unknown world marker kind: ${String(kind)}`);
  const icon = WORLD_MARKER_ICONS[kind];
  const place = placeLabel?.trim();
  if (place && containsPsychologicalLabel(place)) {
    throw new Error('World marker place label contains psychological/analytical vocabulary.');
  }
  return {
    kind,
    glyph: icon.glyph,
    label: icon.label,
    accessibleName: place ? `${icon.label}, ${place}` : icon.label
  };
}
