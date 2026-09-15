/**
 * Atlas of One — Landmark Sanctuaries
 *
 * Authored 16-bit JRPG architectural settings for the 8 territorial landmarks.
 * In 16-bit classics (Chrono Trigger, Zelda: ALttP, Secret of Mana), visiting
 * a landmark immerses the player into a distinct sanctuary with its own
 * lore, architecture, and visual aura.
 */

export interface Sanctuary {
  territoryId: string;
  name: string;
  glyph: string;
  architecture: string;
  atmosphere: string;
  accentColor: string;
}

export const SANCTUARIES: Record<string, Sanctuary> = {
  identity: {
    territoryId: 'identity',
    name: 'Origin Grove Shrine',
    glyph: '🌿',
    architecture: 'Ancient mossy stone altar nestled beneath whispering emerald saplings.',
    atmosphere: 'Ancient Arbor',
    accentColor: '#4ae3b5'
  },
  values: {
    territoryId: 'values',
    name: 'Tribunal of Values',
    glyph: '⚖️',
    architecture: 'Sunlit marble colonnade flanked by enduring tapestries of duty and grace.',
    atmosphere: 'Sunlit Court',
    accentColor: '#f4dfa2'
  },
  politics: {
    territoryId: 'politics',
    name: 'Forum of Concord',
    glyph: '🏛️',
    architecture: 'Concentric carved stone benches encircling an open civic debate dais.',
    atmosphere: 'Noble Assembly',
    accentColor: '#7aa2f7'
  },
  relationships: {
    territoryId: 'relationships',
    name: 'Beacon of Kinship',
    glyph: '⚓',
    architecture: 'Sheltered coastal hearthfire and stone pier overlooking twilight tide pools.',
    atmosphere: 'Warm Hearth',
    accentColor: '#ff9e64'
  },
  cognition: {
    territoryId: 'cognition',
    name: 'Archive of Axioms',
    glyph: '📜',
    architecture: 'Soaring cedar bookshelves and candlelit desks lined with illuminated codices.',
    atmosphere: 'Quiet Study',
    accentColor: '#bb9af7'
  },
  interests: {
    territoryId: 'interests',
    name: 'Atelier of Curios',
    glyph: '🧭',
    architecture: 'Workshop of brass orreries, star charts, drafting compasses, and specimen cabinets.',
    atmosphere: 'Vibrant Craft',
    accentColor: '#73daca'
  },
  fears: {
    territoryId: 'fears',
    name: 'Abyssal Chasm',
    glyph: '🌑',
    architecture: 'Quiet obsidian monoliths guarding a mist-shrouded reflection pool.',
    atmosphere: 'Solemn Vigil',
    accentColor: '#f7768e'
  },
  future: {
    territoryId: 'future',
    name: 'Spire of Horizons',
    glyph: '🔭',
    architecture: 'High glass observation terrace extending toward the vast starlit horizon.',
    atmosphere: 'Infinite Vista',
    accentColor: '#2ac3de'
  }
};

const DEFAULT_SANCTUARY: Sanctuary = {
  territoryId: 'unknown',
  name: 'Cartographer Sanctuary',
  glyph: '◈',
  architecture: 'A quiet clearing where the island boundaries are drawn and explored.',
  atmosphere: 'Still Clearing',
  accentColor: '#f4dfa2'
};

export function sanctuaryFor(territoryId: string): Sanctuary {
  return SANCTUARIES[territoryId] ?? DEFAULT_SANCTUARY;
}
