import { routeBetween } from './geography';

export interface Waystone {
  id: string;
  x: number;
  y: number;
  title: string;
  inscription: string;
}

/**
 * Authored waystones positioned along charted trails.
 * Each offers diegetic environmental storytelling and directional guidance.
 */
export const WAYSTONES: Waystone[] = [
  {
    id: 'waystone-identity-politics',
    x: 182,
    y: 220,
    title: 'Highland Obelisk',
    inscription:
      'Northward ascends the Republic of Politics — where power and consensus are deliberated. Southward lies the Origin of Identity.'
  },
  {
    id: 'waystone-identity-values',
    x: 135,
    y: 269,
    title: 'Shrine Marker',
    inscription:
      'Westward rise the Shrines of Values — where convictions meet sacrifice. Tread thoughtfully upon these granite steps.'
  },
  {
    id: 'waystone-identity-relationships',
    x: 133,
    y: 383,
    title: 'Threshold Archway',
    inscription:
      'South-West to the Coastal Flats of Relationships — the bridges built, maintained, and crossed between lives.'
  },
  {
    id: 'waystone-identity-cognition',
    x: 232,
    y: 273,
    title: 'Terrace Signpost',
    inscription:
      'Eastward to the Archives of Cognition — where assumptions are questioned and revised under open skies.'
  },
  {
    id: 'waystone-identity-fears',
    x: 233,
    y: 384,
    title: 'Shadow Cairn',
    inscription:
      'Eastward into the Marsh of Fears — respect the weight of what is avoided, for avoidance shapes the map.'
  },
  {
    id: 'waystone-identity-interests',
    x: 172,
    y: 427,
    title: 'Meadow Boundary Post',
    inscription:
      'Southward slopes the Valley of Interests — where curiosity blooms and quiet crafts are honed.'
  },
  {
    id: 'waystone-interests-future',
    x: 217,
    y: 558,
    title: 'Cape Lighthouse Marker',
    inscription:
      'South-East toward the Horizon Islet of Future & Ambition — a beacon across open water for journeys yet unwritten.'
  }
];

export function findNearbyWaystone(x: number, y: number, radius = 36): Waystone | null {
  for (const stone of WAYSTONES) {
    const d = Math.hypot(x - stone.x, y - stone.y);
    if (d <= radius) return stone;
  }
  return null;
}
