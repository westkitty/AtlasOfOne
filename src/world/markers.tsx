import type { AdventureKind } from '../contracts/adventure';

/**
 * Public Worldwalker marker categories.
 *
 * These communicate only what kind of *game thing* is present. They must never
 * encode why Atlas selected it, a KnowledgeGap kind/priority, a private topic,
 * or a personality interpretation.
 */
export const WORLD_MARKER_KINDS = [
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
] as const;

export type WorldMarkerKind = (typeof WORLD_MARKER_KINDS)[number];

export interface WorldMarkerDefinition {
  kind: WorldMarkerKind;
  /** Short player-facing category label. */
  label: string;
  /** Text glyph gives every category a non-color visual identity. */
  glyph: string;
  /** Screen-reader name. Must describe gameplay category, never analytic intent. */
  ariaLabel: string;
}

export interface WorldMarkerRenderInput {
  kind: WorldMarkerKind;
  /** Stable local source identifier (seed, encounter, memory, etc.). Not shown to the player. */
  sourceId: string;
}

export interface WorldMarkerRenderModel extends WorldMarkerDefinition {
  id: string;
  testId: string;
}

export const WORLD_MARKER_DEFINITIONS: Readonly<Record<WorldMarkerKind, WorldMarkerDefinition>> = {
  adventure: { kind: 'adventure', label: 'Adventure', glyph: '◆', ariaLabel: 'Adventure opportunity' },
  'journal-shrine': { kind: 'journal-shrine', label: 'Journal', glyph: '▤', ariaLabel: 'Optional journal shrine' },
  'npc-conversation': { kind: 'npc-conversation', label: 'Conversation', glyph: '◌', ariaLabel: 'NPC conversation' },
  encounter: { kind: 'encounter', label: 'Encounter', glyph: '!', ariaLabel: 'Encounter' },
  'mystery-door': { kind: 'mystery-door', label: 'Mystery Door', glyph: '◇', ariaLabel: 'Mystery Door' },
  'boss-arena': { kind: 'boss-arena', label: 'Boss', glyph: '▲', ariaLabel: 'Boss arena' },
  memory: { kind: 'memory', label: 'Memory', glyph: '⌁', ariaLabel: 'World memory' },
  discovery: { kind: 'discovery', label: 'Discovery', glyph: '✧', ariaLabel: 'Environmental discovery' },
  sanctuary: { kind: 'sanctuary', label: 'Sanctuary', glyph: '⌂', ariaLabel: 'Sanctuary interaction' },
  'pure-fun': { kind: 'pure-fun', label: 'Just for fun', glyph: '★', ariaLabel: 'Pure fun event' }
};

const WORLD_MARKER_KIND_SET = new Set<string>(WORLD_MARKER_KINDS);

const ADVENTURE_KINDS = new Set<AdventureKind>([
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
]);

const INTERACTABLE_MARKERS: Readonly<Record<string, WorldMarkerKind | null>> = {
  landmark: 'sanctuary',
  door: 'mystery-door',
  boss: 'boss-arena',
  waystone: 'discovery',
  prop: 'discovery',
  exit: null
};

export function isWorldMarkerKind(value: unknown): value is WorldMarkerKind {
  return typeof value === 'string' && WORLD_MARKER_KIND_SET.has(value);
}

export function worldMarkerDefinition(kind: unknown): WorldMarkerDefinition | null {
  return isWorldMarkerKind(kind) ? WORLD_MARKER_DEFINITIONS[kind] : null;
}

const token = (value: string) => `${value.length}:${value}`;

/** Collision-safe, deterministic local marker identity. */
export function worldMarkerId(kind: WorldMarkerKind, sourceId: string): string | null {
  const cleanSourceId = sourceId.trim();
  if (!cleanSourceId) return null;
  return `world-marker:${token(kind)}:${token(cleanSourceId)}`;
}

/**
 * Compile presentation-safe marker metadata. Unknown/malformed input fails closed.
 * Extra properties on imported/untrusted objects are ignored rather than surfaced.
 */
export function createWorldMarkerRenderModel(input: unknown): WorldMarkerRenderModel | null {
  if (!input || typeof input !== 'object') return null;
  const record = input as Record<string, unknown>;
  if (!isWorldMarkerKind(record.kind) || typeof record.sourceId !== 'string') return null;
  const id = worldMarkerId(record.kind, record.sourceId);
  if (!id) return null;
  const definition = WORLD_MARKER_DEFINITIONS[record.kind];
  return {
    ...definition,
    id,
    testId: `world-marker-${definition.kind}`
  };
}

/**
 * W02-safe public mapping: every ordinary Adventure looks simply like an
 * Adventure. Only the explicitly no-learning pure-fun path is distinct.
 */
export function markerKindForAdventureKind(kind: unknown): WorldMarkerKind | null {
  if (typeof kind !== 'string' || !ADVENTURE_KINDS.has(kind as AdventureKind)) return null;
  return kind === 'pure-fun-wildcard' ? 'pure-fun' : 'adventure';
}

/** Existing Worldwalker interactables keep distinct public semantics. */
export function markerKindForInteractableType(type: unknown): WorldMarkerKind | null {
  if (typeof type !== 'string' || !(type in INTERACTABLE_MARKERS)) return null;
  return INTERACTABLE_MARKERS[type] ?? null;
}

/**
 * Reusable icon primitive for W02/W03. It is intentionally unplaced in W01.
 * Meaning is never color-only: every marker has a unique glyph and accessible name.
 */
export function WorldMarkerIcon({ model }: { model: WorldMarkerRenderModel }) {
  return (
    <span
      role="img"
      aria-label={model.ariaLabel}
      data-marker-kind={model.kind}
      data-world-marker-id={model.id}
      data-testid={model.testId}
    >
      {model.glyph}
    </span>
  );
}
