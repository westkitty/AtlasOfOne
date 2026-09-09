/**
 * The shape of the Greyson Map.
 *
 * This module is PRESENTATION ONLY. It decides where places sit, what their
 * coastlines look like and which trails join them. It knows nothing about
 * evidence, coverage, XP or unlocks — `CampaignState` remains the sole authority
 * on what is true, and this file only decides how that truth is drawn.
 *
 * Everything here is deterministic: shapes come from a seeded generator rather
 * than randomness, so the island is the same island on every load, on every
 * device, in every screenshot and in every test.
 */

export const WORLD = { width: 360, height: 640 };

export interface Point { x: number; y: number }

/** Park–Miller PRNG. Small, deterministic, and adequate for drawing coastlines. */
function seeded(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Closed Catmull–Rom through the points, emitted as cubic béziers. */
function closedSpline(points: Point[]): string {
  const count = points.length;
  const round = (value: number) => value.toFixed(1);
  let path = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let index = 0; index < count; index += 1) {
    const previous = points[(index - 1 + count) % count];
    const current = points[index];
    const next = points[(index + 1) % count];
    const after = points[(index + 2) % count];
    const c1 = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
    const c2 = { x: next.x - (after.x - current.x) / 6, y: next.y - (after.y - current.y) / 6 };
    path += ` C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(next.x)} ${round(next.y)}`;
  }
  return `${path} Z`;
}

/**
 * An irregular closed landform. The wobble is what stops a region reading as a
 * circle on a diagram — coastlines are supposed to be untidy.
 */
export function organicShape(cx: number, cy: number, rx: number, ry: number, seed: number, steps = 18, wobble = 0.34): string {
  const random = seeded(seed);
  const points: Point[] = [];
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    const scale = 1 - wobble / 2 + random() * wobble;
    points.push({ x: cx + Math.cos(angle) * rx * scale, y: cy + Math.sin(angle) * ry * scale });
  }
  return closedSpline(points);
}

/** A trail that bends rather than ruling a straight line between two places. */
export function trailPath(from: Point, to: Point, bend: number): string {
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return `M ${from.x} ${from.y} Q ${(midX + (-dy / length) * bend).toFixed(1)} ${(midY + (dx / length) * bend).toFixed(1)}, ${to.x} ${to.y}`;
}

export type LandmarkKind = 'stones' | 'cairn' | 'city' | 'settlement' | 'grove' | 'labyrinth' | 'chasm' | 'lighthouse';

export interface Region {
  /** Matches the deterministic territory id in `CampaignState`. */
  id: string;
  centre: Point;
  /** Where Greyson stands — offset off the label so he is not standing on text. */
  stand: Point;
  rx: number;
  ry: number;
  seed: number;
  landmark: LandmarkKind;
  /** True for the offshore cape, which is reached by sea rather than by trail. */
  offshore?: boolean;
}

/**
 * The eight deterministic territories, read as geography.
 *
 * The island runs north-to-south: the walled Republic at the head, the origin
 * clearing at its heart, and the Future as a cape offshore that has to be
 * crossed to. Sizes follow how much there is to map — the Republic carries
 * sixteen dimensions and is drawn as the largest, strangest polity.
 */
export const REGIONS: Region[] = [
  { id: 'politics', centre: { x: 182, y: 96 }, stand: { x: 182, y: 118 }, rx: 74, ry: 56, seed: 1207, landmark: 'city' },
  { id: 'values', centre: { x: 86, y: 208 }, stand: { x: 86, y: 226 }, rx: 52, ry: 44, seed: 4111, landmark: 'cairn' },
  { id: 'cognition', centre: { x: 279, y: 216 }, stand: { x: 279, y: 234 }, rx: 54, ry: 46, seed: 7717, landmark: 'labyrinth' },
  { id: 'identity', centre: { x: 178, y: 316 }, stand: { x: 178, y: 336 }, rx: 60, ry: 50, seed: 9001, landmark: 'stones' },
  { id: 'relationships', centre: { x: 78, y: 424 }, stand: { x: 78, y: 442 }, rx: 52, ry: 44, seed: 2333, landmark: 'settlement' },
  { id: 'fears', centre: { x: 285, y: 432 }, stand: { x: 285, y: 450 }, rx: 54, ry: 46, seed: 6151, landmark: 'chasm' },
  { id: 'interests', centre: { x: 166, y: 512 }, stand: { x: 166, y: 530 }, rx: 52, ry: 42, seed: 3557, landmark: 'grove' },
  { id: 'future', centre: { x: 262, y: 588 }, stand: { x: 262, y: 602 }, rx: 44, ry: 34, seed: 8821, landmark: 'lighthouse', offshore: true }
];

const byId = new Map(REGIONS.map((region) => [region.id, region]));
/** Regions render at the centre if a campaign ever carries an id this map lacks. */
const FALLBACK: Region = { id: 'unknown', centre: { x: WORLD.width / 2, y: WORLD.height / 2 }, stand: { x: WORLD.width / 2, y: WORLD.height / 2 }, rx: 48, ry: 40, seed: 1, landmark: 'stones' };
export const regionFor = (territoryId: string): Region => byId.get(territoryId) ?? FALLBACK;

export interface Trail { from: string; to: string; bend: number; sea?: boolean }

/** Which places actually touch. The two routes to the cape are sea crossings. */
export const TRAILS: Trail[] = [
  { from: 'identity', to: 'values', bend: 26 },
  { from: 'identity', to: 'cognition', bend: -26 },
  { from: 'identity', to: 'relationships', bend: -22 },
  { from: 'identity', to: 'fears', bend: 22 },
  { from: 'values', to: 'politics', bend: 30 },
  { from: 'cognition', to: 'politics', bend: -30 },
  { from: 'relationships', to: 'interests', bend: -18 },
  { from: 'interests', to: 'future', bend: -16, sea: true },
  { from: 'fears', to: 'future', bend: 14, sea: true }
];

/** The mainland silhouette. The cape is drawn separately, out at sea. */
export const MAINLAND = organicShape(180, 312, 168, 246, 5309, 26, 0.22);
export const CAPE = organicShape(262, 588, 58, 44, 8821, 16, 0.3);

/** Pre-computed so coastlines are not recalculated on every render. */
export const REGION_SHAPES: Record<string, string> = Object.fromEntries(
  REGIONS.map((region) => [region.id, organicShape(region.centre.x, region.centre.y, region.rx, region.ry, region.seed)])
);

export const TRAIL_SHAPES = TRAILS.map((trail) => ({
  ...trail,
  d: trailPath(regionFor(trail.from).stand, regionFor(trail.to).stand, trail.bend)
}));

/**
 * How much of a place is showing.
 *
 * Discovery is progressive on purpose: an unvisited region is a silhouette with
 * no name, so the player is not handed a finished sitemap at turn zero and can
 * actually watch the map become known.
 */
export type Reveal = 'hidden' | 'glimpsed' | 'known' | 'detailed';

export function revealFor(status: string): Reveal {
  if (status === 'fogged') return 'hidden';
  if (status === 'discovered') return 'glimpsed';
  if (status === 'exploring') return 'known';
  return 'detailed';
}
