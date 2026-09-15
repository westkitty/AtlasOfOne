import { ATLAS_MANIFEST } from './manifest.generated';

/**
 * The Greyson Map's geography, as the runtime sees it.
 *
 * Coordinates, region anchors and trail routes all come from the generated art
 * manifest, so the app and the island art can never disagree about where
 * anything is: both are produced by one deterministic build
 * (`npm run art:build`). Nothing here decides progression — `CampaignState`
 * remains the sole authority on what the player has actually earned.
 */

export const PACK = ATLAS_MANIFEST.assetPackVersion;
export const ASSET_BASE = ATLAS_MANIFEST.base;
export const WORLD = { width: ATLAS_MANIFEST.world.width, height: ATLAS_MANIFEST.world.height };
export const LAYERS = ATLAS_MANIFEST.world.layers;
export const CHARACTER = ATLAS_MANIFEST.character;

export interface Point { x: number; y: number }

export interface Region {
  id: string;
  label: string;
  centre: Point;
  /** Where Greyson's bottom-centre anchor sits when he is in this region. */
  stand: Point;
  landmark: string;
  mask: string;
}

const toPoint = ([x, y]: readonly number[]): Point => ({ x, y });

export const REGIONS: Region[] = ATLAS_MANIFEST.world.regions.map((region) => ({
  id: region.id,
  label: region.label,
  centre: toPoint(region.centre),
  stand: toPoint(region.stand),
  landmark: region.landmark,
  mask: region.mask
}));

const byId = new Map(REGIONS.map((region) => [region.id, region]));

/** Falls back to the island's centre so unknown campaign data cannot crash the map. */
const FALLBACK: Region = {
  id: 'unknown', label: 'Unknown', landmark: 'stones', mask: '',
  centre: { x: WORLD.width / 2, y: WORLD.height / 2 },
  stand: { x: WORLD.width / 2, y: WORLD.height / 2 }
};

export const regionFor = (territoryId: string): Region => byId.get(territoryId) ?? FALLBACK;

export interface Trail {
  from: string;
  to: string;
  /** True for the two crossings to the offshore cape, which are not walked. */
  sea: boolean;
  waypoints: Point[];
}

export const TRAILS: Trail[] = ATLAS_MANIFEST.world.trails.map((trail) => ({
  from: trail.from,
  to: trail.to,
  sea: trail.sea,
  waypoints: trail.waypoints.map(toPoint)
}));

/**
 * The route between two regions, oriented from `from` to `to`.
 *
 * Trails are stored once per pair, so travelling the other way reuses the same
 * route reversed rather than needing a second set of waypoints.
 */
export function routeBetween(from: string, to: string): Point[] | null {
  const direct = TRAILS.find((trail) => trail.from === from && trail.to === to);
  if (direct) return direct.waypoints;
  const reverse = TRAILS.find((trail) => trail.from === to && trail.to === from);
  return reverse ? [...reverse.waypoints].reverse() : null;
}

/** Which regions can be reached in one move from here. */
export function neighboursOf(territoryId: string): string[] {
  const out = new Set<string>();
  for (const trail of TRAILS) {
    if (trail.from === territoryId) out.add(trail.to);
    if (trail.to === territoryId) out.add(trail.from);
  }
  return [...out];
}

/**
 * How much of a region is showing.
 *
 * Discovery is progressive on purpose: unvisited country stays a dark
 * silhouette, so watching the island resolve is itself the reward and the map
 * is never handed over finished at turn zero.
 */
export type Reveal = 'hidden' | 'glimpsed' | 'known' | 'detailed';

export function revealFor(status: string): Reveal {
  if (status === 'fogged') return 'hidden';
  if (status === 'discovered') return 'glimpsed';
  if (status === 'exploring') return 'known';
  return 'detailed';
}

/** Opacity of each island layer for a region, given how well it is known. */
export function layerOpacity(reveal: Reveal): { glimpsed: number; revealed: number } {
  switch (reveal) {
    case 'hidden': return { glimpsed: 0, revealed: 0 };
    case 'glimpsed': return { glimpsed: 0.6, revealed: 0 };
    case 'known': return { glimpsed: 1, revealed: 0.35 };
    default: return { glimpsed: 1, revealed: 1 };
  }
}

export const asset = (relative: string) => `${ASSET_BASE}${relative}`;

/** Total length of a route, used to pace travel by distance rather than a fixed time. */
export function routeLength(points: Point[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

/** The position a given fraction along a route. */
export function pointAlong(points: Point[], t: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || t <= 0) return points[0];
  if (t >= 1) return points[points.length - 1];
  const target = routeLength(points) * t;
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const seg = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    if (travelled + seg >= target) {
      const local = seg === 0 ? 0 : (target - travelled) / seg;
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * local,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * local
      };
    }
    travelled += seg;
  }
  return points[points.length - 1];
}
