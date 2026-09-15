/**
 * Atlas of One — Landmark Interior Sanctuaries
 *
 * Authored 16-bit JRPG architectural interiors for all 8 territory sanctuaries.
 * In classic 16-bit JRPGs (Chrono Trigger, Final Fantasy VI, Zelda: ALttP),
 * entering a landmark transitions the player into an authored interior room
 * with inspectable furnishings, artifacts, a dais, and an exit doorway.
 */

export interface InteriorProp {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  glyph: string;
  color: string;
  inscription: string;
}

export interface InteriorRoom {
  territoryId: string;
  title: string;
  width: number;
  height: number;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  doorway: { x: number; y: number; width: number; height: number };
  spawnPoint: { x: number; y: number };
  cartographerDais: { x: number; y: number; label: string };
  floorColor: string;
  wallColor: string;
  accentColor: string;
  props: InteriorProp[];
}

export const INTERIOR_ROOMS: Record<string, InteriorRoom> = {
  identity: {
    territoryId: 'identity',
    title: 'Origin Grove Shrine Sanctuary',
    width: 360,
    height: 360,
    bounds: { minX: 40, maxX: 320, minY: 75, maxY: 310 },
    doorway: { x: 180, y: 315, width: 44, height: 26 },
    spawnPoint: { x: 180, y: 280 },
    cartographerDais: { x: 180, y: 110, label: 'Altar of Origins' },
    floorColor: '#12231e',
    wallColor: '#091612',
    accentColor: '#4ae3b5',
    props: [
      {
        id: 'origin-altar',
        label: 'Mossy Stone Altar',
        x: 180,
        y: 110,
        width: 38,
        height: 24,
        glyph: '🌿',
        color: '#4ae3b5',
        inscription: 'Carved with concentric tree-rings representing the roots of who Greyson has been and who they are becoming.'
      },
      {
        id: 'mirror-basin',
        label: 'Mirror Reflection Basin',
        x: 90,
        y: 150,
        width: 26,
        height: 26,
        glyph: '🪞',
        color: '#88d8b0',
        inscription: 'Still spring water reflecting neither flattering myth nor harsh distortion—only the clear, unvarnished coordinate.'
      },
      {
        id: 'whispering-sapling',
        label: 'Whispering Sapling',
        x: 270,
        y: 150,
        width: 24,
        height: 28,
        glyph: '🌱',
        color: '#a3f7bf',
        inscription: 'A silver-barked sapling growing directly through the stone floor, vibrant with resilient life.'
      }
    ]
  },
  values: {
    territoryId: 'values',
    title: 'Tribunal of Values Court',
    width: 360,
    height: 360,
    bounds: { minX: 40, maxX: 320, minY: 75, maxY: 310 },
    doorway: { x: 180, y: 315, width: 44, height: 26 },
    spawnPoint: { x: 180, y: 280 },
    cartographerDais: { x: 180, y: 110, label: 'High Bench of Principles' },
    floorColor: '#262218',
    wallColor: '#16130b',
    accentColor: '#f4dfa2',
    props: [
      {
        id: 'balance-scale',
        label: 'Golden Balance Scales',
        x: 180,
        y: 110,
        width: 34,
        height: 24,
        glyph: '⚖️',
        color: '#f4dfa2',
        inscription: 'Balances forged of weathered gold. They measure not rigid perfection, but integrity held under strain.'
      },
      {
        id: 'duty-tapestry',
        label: 'Tapestry of Conviction',
        x: 90,
        y: 140,
        width: 28,
        height: 30,
        glyph: '📜',
        color: '#e2cb8b',
        inscription: 'Woven fibers showing promises kept when convenience pleaded otherwise.'
      },
      {
        id: 'veracity-cairn',
        label: 'Plinth of Clear Truth',
        x: 270,
        y: 140,
        width: 26,
        height: 26,
        glyph: '🕯️',
        color: '#fff3cb',
        inscription: 'A steady flame burning in clear glass. It does not flicker with changing tides.'
      }
    ]
  },
  politics: {
    territoryId: 'politics',
    title: 'Forum of Concord Council Hall',
    width: 360,
    height: 360,
    bounds: { minX: 40, maxX: 320, minY: 75, maxY: 310 },
    doorway: { x: 180, y: 315, width: 44, height: 26 },
    spawnPoint: { x: 180, y: 280 },
    cartographerDais: { x: 180, y: 110, label: 'Debate Dais' },
    floorColor: '#19202b',
    wallColor: '#0e131c',
    accentColor: '#7aa2f7',
    props: [
      {
        id: 'charter-lectern',
        label: 'Civic Charter Lectern',
        x: 180,
        y: 110,
        width: 32,
        height: 22,
        glyph: '🏛️',
        color: '#7aa2f7',
        inscription: 'A heavy stone lectern bearing inscriptions on power, responsibility, and the social compact.'
      },
      {
        id: 'council-benches',
        label: 'Concentric Stone Benches',
        x: 90,
        y: 160,
        width: 36,
        height: 20,
        glyph: '🪑',
        color: '#89b4fa',
        inscription: 'Arranged so every speaker faces their peers directly, without an elevated throne.'
      },
      {
        id: 'concord-banner',
        label: 'Standard of Collective Will',
        x: 270,
        y: 140,
        width: 24,
        height: 32,
        glyph: '🚩',
        color: '#b4befe',
        inscription: 'Inscribed: "Freedom without solidarity is isolation; solidarity without freedom is coercion."'
      }
    ]
  },
  relationships: {
    territoryId: 'relationships',
    title: 'Beacon of Kinship Hearth',
    width: 360,
    height: 360,
    bounds: { minX: 40, maxX: 320, minY: 75, maxY: 310 },
    doorway: { x: 180, y: 315, width: 44, height: 26 },
    spawnPoint: { x: 180, y: 280 },
    cartographerDais: { x: 180, y: 110, label: 'Hearth Table' },
    floorColor: '#281c15',
    wallColor: '#170f0b',
    accentColor: '#ff9e64',
    props: [
      {
        id: 'kinship-hearth',
        label: 'Perpetual Coastal Hearthfire',
        x: 180,
        y: 110,
        width: 36,
        height: 26,
        glyph: '🔥',
        color: '#ff9e64',
        inscription: 'Crackling drift-logs radiating gentle warmth to all who seek shelter from the sea wind.'
      },
      {
        id: 'communal-table',
        label: 'Cedar Dining Table',
        x: 90,
        y: 160,
        width: 34,
        height: 22,
        glyph: '🪑',
        color: '#f9e2af',
        inscription: 'Worn smooth by shared meals, shared laughter, and quiet late-night confidences.'
      },
      {
        id: 'observation-balcony',
        label: 'Sea Pier Threshold',
        x: 270,
        y: 140,
        width: 28,
        height: 28,
        glyph: '⚓',
        color: '#fab387',
        inscription: 'Looking out over the twilight surf where inbound boats find safe anchorage.'
      }
    ]
  },
  cognition: {
    territoryId: 'cognition',
    title: 'Archive of Axioms Library',
    width: 360,
    height: 360,
    bounds: { minX: 40, maxX: 320, minY: 75, maxY: 310 },
    doorway: { x: 180, y: 315, width: 44, height: 26 },
    spawnPoint: { x: 180, y: 280 },
    cartographerDais: { x: 180, y: 110, label: 'Curator Desk' },
    floorColor: '#201b2a',
    wallColor: '#120e1a',
    accentColor: '#bb9af7',
    props: [
      {
        id: 'axioms-bookcase',
        label: 'Towering Cedar Bookcases',
        x: 90,
        y: 130,
        width: 38,
        height: 34,
        glyph: '📚',
        color: '#bb9af7',
        inscription: 'Rows of hand-bound codices analyzing how ideas connect, mutate, and crystallize into conviction.'
      },
      {
        id: 'curator-desk',
        label: 'Parchment Study Desk',
        x: 180,
        y: 110,
        width: 36,
        height: 24,
        glyph: '📜',
        color: '#cba6f7',
        inscription: 'Laid out with ink pots, quill sharpeners, and margin notes questioning prior hypotheses.'
      },
      {
        id: 'celestial-globe',
        label: 'Illuminated Thought Sphere',
        x: 270,
        y: 140,
        width: 28,
        height: 28,
        glyph: '🌐',
        color: '#f5c2e7',
        inscription: 'A glowing brass armillary sphere tracing the orbits of logic and intuition.'
      }
    ]
  },
  interests: {
    territoryId: 'interests',
    title: 'Atelier of Curios Workshop',
    width: 360,
    height: 360,
    bounds: { minX: 40, maxX: 320, minY: 75, maxY: 310 },
    doorway: { x: 180, y: 315, width: 44, height: 26 },
    spawnPoint: { x: 180, y: 280 },
    cartographerDais: { x: 180, y: 110, label: 'Master Workbench' },
    floorColor: '#142524',
    wallColor: '#0b1615',
    accentColor: '#73daca',
    props: [
      {
        id: 'craft-workbench',
        label: 'Drafting Workbench',
        x: 180,
        y: 110,
        width: 38,
        height: 24,
        glyph: '🛠️',
        color: '#73daca',
        inscription: 'Covered with drafting compasses, gears, copper wire, and half-assembled inventions.'
      },
      {
        id: 'curio-cabinet',
        label: 'Curiosity Cabinet',
        x: 90,
        y: 140,
        width: 32,
        height: 30,
        glyph: '🧭',
        color: '#94e2d5',
        inscription: 'Shelves holding polished beach stones, rare mechanical watches, and antique compasses.'
      },
      {
        id: 'brass-orrery',
        label: 'Clockwork Astrolabe',
        x: 270,
        y: 140,
        width: 28,
        height: 28,
        glyph: '⚙️',
        color: '#89dceb',
        inscription: 'Interlocking brass gears ticking softly, modeling both the solar system and creative obsession.'
      }
    ]
  },
  fears: {
    territoryId: 'fears',
    title: 'Abyssal Chasm Vigil Sanctuary',
    width: 360,
    height: 360,
    bounds: { minX: 40, maxX: 320, minY: 75, maxY: 310 },
    doorway: { x: 180, y: 315, width: 44, height: 26 },
    spawnPoint: { x: 180, y: 280 },
    cartographerDais: { x: 180, y: 110, label: 'Obsidian Stele' },
    floorColor: '#241419',
    wallColor: '#15090e',
    accentColor: '#f7768e',
    props: [
      {
        id: 'shadow-stele',
        label: 'Obsidian Guardian Monolith',
        x: 180,
        y: 110,
        width: 32,
        height: 26,
        glyph: '🌑',
        color: '#f7768e',
        inscription: 'Cold black volcanic glass that absorbs light. Facing it requires stillness rather than bravado.'
      },
      {
        id: 'vigil-brazier',
        label: 'Solemn Vigil Brazier',
        x: 90,
        y: 150,
        width: 26,
        height: 26,
        glyph: '🕯️',
        color: '#eba0ac',
        inscription: 'A solitary charcoal ember glowing in the quiet darkness, warding against despair.'
      },
      {
        id: 'shadow-well',
        label: 'Deep Reflection Well',
        x: 270,
        y: 150,
        width: 28,
        height: 28,
        glyph: '🕳️',
        color: '#f38ba8',
        inscription: 'A profound well whose bottom cannot be seen. Echoes returned from it sound like raw vulnerability.'
      }
    ]
  },
  future: {
    territoryId: 'future',
    title: 'Spire of Horizons Observatory',
    width: 360,
    height: 360,
    bounds: { minX: 40, maxX: 320, minY: 75, maxY: 310 },
    doorway: { x: 180, y: 315, width: 44, height: 26 },
    spawnPoint: { x: 180, y: 280 },
    cartographerDais: { x: 180, y: 110, label: 'Horizon Dais' },
    floorColor: '#13212b',
    wallColor: '#09131a',
    accentColor: '#2ac3de',
    props: [
      {
        id: 'horizon-telescope',
        label: 'Grand Refractor Telescope',
        x: 180,
        y: 110,
        width: 36,
        height: 26,
        glyph: '🔭',
        color: '#2ac3de',
        inscription: 'Polished brass lenses pointed toward the sea horizon where dawn first breaks.'
      },
      {
        id: 'star-charts',
        label: 'Celestial Star Map Desk',
        x: 90,
        y: 140,
        width: 32,
        height: 26,
        glyph: '✨',
        color: '#7dcfff',
        inscription: 'Constellations annotated with long-term hopes, unfinished projects, and uncharted destinations.'
      },
      {
        id: 'beacon-prism',
        label: 'Prism Lighthouse Lens',
        x: 270,
        y: 140,
        width: 28,
        height: 28,
        glyph: '💎',
        color: '#b4f9f8',
        inscription: 'A cut crystal rotating silently, projecting beams of warm light far into the night sky.'
      }
    ]
  }
};

export function interiorFor(territoryId: string): InteriorRoom {
  return INTERIOR_ROOMS[territoryId] ?? INTERIOR_ROOMS.identity;
}

/** Checks if a coordinate is within the walkable room boundary and not colliding with props */
export function isInteriorWalkable(x: number, y: number, room: InteriorRoom): boolean {
  // Check doorway zone (always walkable)
  const d = room.doorway;
  if (x >= d.x - d.width / 2 && x <= d.x + d.width / 2 && y >= d.y - d.height / 2 && y <= d.y + d.height / 2) {
    return true;
  }

  // Check main room bounds
  const b = room.bounds;
  if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) {
    return false;
  }

  // Check prop bounding boxes
  for (const prop of room.props) {
    const halfW = prop.width / 2 + 6;
    const halfH = prop.height / 2 + 6;
    if (x >= prop.x - halfW && x <= prop.x + halfW && y >= prop.y - halfH && y <= prop.y + halfH) {
      return false;
    }
  }

  return true;
}

/** Finds a nearby inspectable prop within interaction reach */
export function findNearbyInteriorProp(
  x: number,
  y: number,
  room: InteriorRoom,
  maxDistance = 34
): InteriorProp | null {
  let closest: InteriorProp | null = null;
  let minD = maxDistance;

  for (const prop of room.props) {
    const d = Math.hypot(x - prop.x, y - prop.y);
    if (d < minD) {
      minD = d;
      closest = prop;
    }
  }

  return closest;
}

/** Checks if player is standing on the exit doorway mat */
export function isAtDoorwayExit(x: number, y: number, room: InteriorRoom): boolean {
  const d = room.doorway;
  return Math.hypot(x - d.x, y - d.y) < 22;
}
