"""
The Greyson Map — island generator.

Design intent
-------------
The island's MACRO geometry is authored, not generated: the landmasses, the
ridge lines, the river sources and the region anchors below are all placed by
hand. Noise is used only for micro-irregularity — coastline wobble and terrain
texture — because a wholly procedural island reads as noise, and that is exactly
what previous attempts were rejected for.

Everything is deterministic. Same seed, same island, every run.

Output is pixel art at the app's native 360x640 coordinate space, so it drops
into the existing world without any layout change.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field

W, H = 360, 640
SEED = 20260909

# ---------------------------------------------------------------------------
# Authored macro geometry
# ---------------------------------------------------------------------------

# Elliptical land masses, blended together into one irregular island.
# (cx, cy, rx, ry, weight)
MASSES = [
    (186, 108, 104, 78, 1.00),   # northern plateau — the Republic sits up here
    (183, 232, 126, 108, 0.95),  # central massif, ties north to centre
    (92, 208, 78, 66, 0.90),     # western highland shoulder
    (286, 216, 74, 66, 0.88),    # eastern terraces
    (178, 330, 104, 92, 0.95),   # central basin — the origin clearing
    (150, 420, 116, 84, 0.90),   # south-west lowland
    (96, 436, 76, 62, 0.88),     # coastal flat + river mouth
    (286, 438, 74, 62, 0.86),    # south-east marsh basin
    (172, 528, 88, 62, 0.86),    # southern valley
]

CAPE = (268, 592, 46, 34, 1.0)   # offshore islet, reached by sea

# Ridge lines raise elevation along them. (points, height, radius)
RIDGES = [
    ([(126, 92), (176, 66), (232, 86), (262, 132)], 1.00, 46),   # northern massif
    ([(64, 176), (92, 206), (112, 246)], 0.92, 38),              # western ridge
    ([(312, 178), (288, 214), (266, 252)], 0.88, 36),            # eastern terraces
    ([(196, 168), (186, 214)], 0.62, 40),                        # saddle to the centre
]

# Basins push elevation down — real low ground, not just flat.
BASINS = [
    ((178, 336), 0.42, 74),   # the origin clearing
    ((96, 448), 0.50, 62),    # river mouth flat
    ((288, 448), 0.58, 60),   # the marsh
    ((172, 534), 0.38, 60),   # southern valley
]

# Region anchors. `stand` is where Greyson's feet go.
@dataclass
class Region:
    id: str
    centre: tuple
    stand: tuple
    landmark: str
    label: str

REGIONS = [
    Region('politics',      (188, 104), (188, 132), 'city',       'The Republic of Greyson'),
    Region('values',        (86, 210),  (92, 232),  'cairn',      'Values'),
    Region('cognition',     (290, 218), (284, 240), 'terraces',   'Cognition'),
    Region('identity',      (178, 330), (178, 352), 'stones',     'Identity'),
    Region('relationships', (92, 442),  (98, 460),  'settlement', 'Relationships'),
    Region('fears',         (288, 444), (284, 462), 'marsh',      'Fear Map'),
    Region('interests',     (168, 530), (168, 548), 'grove',      'Interests'),
    Region('future',        (268, 592), (268, 606), 'lighthouse', 'Future'),
]

# Trails follow terrain. Authored waypoints, not straight graph edges.
TRAILS = [
    ('identity', 'values',        [(178, 352), (150, 330), (126, 296), (108, 262), (92, 232)], False),
    ('identity', 'cognition',     [(178, 352), (214, 332), (246, 300), (268, 268), (284, 240)], False),
    ('identity', 'relationships', [(178, 352), (156, 386), (130, 414), (112, 440), (98, 460)], False),
    ('identity', 'fears',         [(178, 352), (212, 378), (246, 404), (270, 434), (284, 462)], False),
    ('values',   'politics',      [(92, 232), (104, 196), (126, 160), (156, 138), (188, 132)], False),
    ('cognition','politics',      [(284, 240), (272, 202), (248, 168), (218, 142), (188, 132)], False),
    ('relationships','interests', [(98, 460), (118, 492), (140, 516), (168, 548)], False),
    ('interests','future',        [(168, 548), (198, 570), (228, 588), (268, 606)], True),
    ('fears',    'future',        [(284, 462), (296, 502), (292, 546), (268, 606)], True),
]

# ---------------------------------------------------------------------------
# Palette — a night island under lantern-gold survey light
# ---------------------------------------------------------------------------

PAL = {
    'sea_deep':   (5, 9, 14),
    'sea_mid':    (8, 15, 23),
    'sea_shal':   (13, 26, 38),
    'surf':       (30, 52, 70),
    'sand':       (74, 74, 66),
    'marsh':      (26, 38, 40),
    'low':        (34, 50, 45),
    'grass':      (45, 62, 52),
    'grass_hi':   (58, 76, 61),
    'slope':      (76, 88, 70),
    'rock':       (98, 104, 84),
    'rock_hi':    (124, 124, 100),
    'peak':       (156, 150, 118),
    'cliff':      (16, 24, 28),
    'forest':     (28, 46, 38),
    'forest_hi':  (40, 62, 48),
    'river':      (20, 38, 52),
    'gold':       (217, 197, 143),
    'gold_soft':  (241, 221, 165),
    'gold_dim':   (139, 122, 82),
    'stone':      (86, 92, 88),
    'stone_hi':   (120, 124, 116),
    'wall':       (70, 74, 74),
    'timber':     (60, 52, 44),
    'lit':        (232, 199, 122),
}


# ---------------------------------------------------------------------------
# Deterministic noise
# ---------------------------------------------------------------------------

def _value_noise(shape, freq, rng):
    """Smooth value noise by bilinear upsampling of a coarse random grid."""
    gh, gw = max(2, int(shape[0] * freq)), max(2, int(shape[1] * freq))
    grid = rng.random((gh, gw))
    ys = np.linspace(0, gh - 1, shape[0])
    xs = np.linspace(0, gw - 1, shape[1])
    y0 = np.floor(ys).astype(int); x0 = np.floor(xs).astype(int)
    y1 = np.minimum(y0 + 1, gh - 1); x1 = np.minimum(x0 + 1, gw - 1)
    fy = (ys - y0)[:, None]; fx = (xs - x0)[None, :]
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    top = grid[np.ix_(y0, x0)] * (1 - fx) + grid[np.ix_(y0, x1)] * fx
    bot = grid[np.ix_(y1, x0)] * (1 - fx) + grid[np.ix_(y1, x1)] * fx
    return top * (1 - fy) + bot * fy


def fbm(shape, rng, octaves=5, freq=0.012, gain=0.5):
    total = np.zeros(shape); amp = 1.0; norm = 0.0
    for _ in range(octaves):
        total += amp * _value_noise(shape, freq, rng)
        norm += amp; amp *= gain; freq *= 2.0
    return total / norm


# ---------------------------------------------------------------------------
# Height field
# ---------------------------------------------------------------------------

def _ellipse_field(cx, cy, rx, ry, yy, xx):
    d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2
    return np.clip(1.0 - d, 0.0, 1.0)


def _polyline_distance(points, yy, xx):
    best = np.full(yy.shape, 1e9)
    for (ax, ay), (bx, by) in zip(points[:-1], points[1:]):
        vx, vy = bx - ax, by - ay
        L2 = max(vx * vx + vy * vy, 1e-6)
        t = np.clip(((xx - ax) * vx + (yy - ay) * vy) / L2, 0, 1)
        px, py = ax + t * vx, ay + t * vy
        best = np.minimum(best, np.hypot(xx - px, yy - py))
    return best


def build_height(rng):
    yy, xx = np.mgrid[0:H, 0:W].astype(float)

    # Authored mass blend — a smooth union, so the coast is one continuous edge.
    # Probabilistic union (1 - prod(1-f)) blends the masses into a single
    # continuous landmass; a plain max() leaves visible circle seams.
    inv = np.ones((H, W))
    for cx, cy, rx, ry, wgt in MASSES:
        inv *= (1.0 - _ellipse_field(cx, cy, rx, ry, yy, xx) * wgt)
    land = 1.0 - inv

    cape = _ellipse_field(*CAPE[:4], yy, xx) * CAPE[4]

    # Coastline irregularity: noise displaces the shore without moving the mass.
    coast_noise = fbm((H, W), rng, octaves=6, freq=0.007)
    detail = fbm((H, W), rng, octaves=4, freq=0.030)
    land = land + (coast_noise - 0.5) * 0.62 + (detail - 0.5) * 0.14
    cape = cape + (coast_noise - 0.5) * 0.22

    land = np.maximum(land, cape)
    sea_level = 0.46
    mask = land > sea_level

    # Elevation: ridges lift, basins press down, noise roughens.
    elev = np.clip((land - sea_level) / (1 - sea_level), 0, 1) * 0.42
    for pts, hgt, rad in RIDGES:
        d = _polyline_distance(pts, yy, xx)
        elev += hgt * np.clip(1 - d / rad, 0, 1) ** 1.6 * 0.62
    for (bx, by), depth, rad in BASINS:
        d = np.hypot(xx - bx, yy - by)
        elev -= depth * np.clip(1 - d / rad, 0, 1) ** 1.4
    elev += (fbm((H, W), rng, octaves=6, freq=0.026) - 0.5) * 0.16
    elev = np.clip(elev, 0, 1.4)
    elev[~mask] = 0.0
    return land, mask, elev, sea_level


# ---------------------------------------------------------------------------
# Rivers — steepest descent from authored sources to the sea
# ---------------------------------------------------------------------------

RIVER_SOURCES = [(176, 88), (232, 104), (86, 214), (292, 210)]


def carve_rivers(elev, mask, rng):
    river = np.zeros((H, W), dtype=bool)
    for sx, sy in RIVER_SOURCES:
        x, y = float(sx), float(sy)
        for _ in range(900):
            ix, iy = int(round(x)), int(round(y))
            if not (1 <= ix < W - 1 and 1 <= iy < H - 1):
                break
            if not mask[iy, ix]:
                break
            river[iy, ix] = True
            # Look at the 8-neighbourhood and step to the lowest cell.
            best, bx, by = elev[iy, ix], None, None
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    v = elev[iy + dy, ix + dx]
                    if v < best:
                        best, bx, by = v, ix + dx, iy + dy
            if bx is None:
                # In a pit: nudge downhill-ish and keep going rather than stop.
                x += rng.integers(-1, 2); y += 1
                continue
            x, y = bx, by
    # Widen slightly so a river reads at this scale.
    wide = river.copy()
    ys, xs = np.nonzero(river)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            yy = np.clip(ys + dy, 0, H - 1); xx = np.clip(xs + dx, 0, W - 1)
            keep = elev[yy, xx] < 0.55
            wide[yy[keep], xx[keep]] = True
    return wide & mask


# ---------------------------------------------------------------------------
# Rendering — terraced relief, lit consistently from the north-west
# ---------------------------------------------------------------------------

BANDS = [
    (0.00, 'marsh'), (0.12, 'low'), (0.26, 'grass'), (0.42, 'grass_hi'),
    (0.56, 'slope'), (0.72, 'rock'), (0.88, 'rock_hi'), (1.04, 'peak'),
]


def band_index(elev):
    idx = np.zeros(elev.shape, dtype=int)
    for i, (lo, _) in enumerate(BANDS):
        idx[elev >= lo] = i
    return idx


def render_terrain(mask, elev, river, rng):
    rgb = np.zeros((H, W, 3), dtype=np.uint8)
    rgb[:, :] = PAL['sea_deep']

    # Sea shelf: the water shallows as it approaches land.
    from scipy.ndimage import distance_transform_edt, binary_dilation
    sea_dist = distance_transform_edt(~mask)
    rgb[(~mask) & (sea_dist < 26)] = PAL['sea_mid']
    rgb[(~mask) & (sea_dist < 11)] = PAL['sea_shal']
    rgb[(~mask) & (sea_dist < 4)] = PAL['surf']

    idx = band_index(elev)
    for i, (_, key) in enumerate(BANDS):
        rgb[mask & (idx == i)] = PAL[key]

    # Beaches where low land meets water.
    land_dist = distance_transform_edt(mask)
    rgb[mask & (land_dist <= 2) & (elev < 0.34)] = PAL['sand']

    # Terrace edges. A step up is lit on its north-west face and shadowed on the
    # south-east one; that single rule is what makes flat bands read as relief.
    gy, gx = np.gradient(elev)
    steep = np.hypot(gx, gy) > 0.010
    up_nw = np.zeros((H, W), dtype=bool)
    dn_se = np.zeros((H, W), dtype=bool)
    up_nw[1:, 1:] = (idx[1:, 1:] > idx[:-1, :-1]) & mask[1:, 1:] & steep[1:, 1:]
    dn_se[:-1, :-1] = (idx[:-1, :-1] > idx[1:, 1:]) & mask[:-1, :-1] & steep[:-1, :-1]
    lit = np.array(PAL['stone_hi'], dtype=np.int16)
    for i, (_, key) in enumerate(BANDS):
        sel = up_nw & (idx == i)
        base = np.array(PAL[key], dtype=np.int16)
        rgb[sel] = np.clip(base + (lit - base) * 0.30, 0, 255).astype(np.uint8)
    rgb[dn_se] = PAL['cliff']

    # Forests: deterministic clustered scatter in the mid bands, denser where
    # moisture (distance from high ground) is higher.
    moisture = fbm((H, W), rng, octaves=4, freq=0.02)
    forest = mask & (elev > 0.16) & (elev < 0.60) & (moisture > 0.54) & (~river)
    ys, xs = np.nonzero(forest)
    pick = rng.random(len(ys)) < 0.055
    for y, x in zip(ys[pick], xs[pick]):
        if 2 <= x < W - 2 and 3 <= y < H - 2:
            rgb[y - 2:y + 1, x - 1:x + 2] = PAL['forest']
            rgb[y - 3, x] = PAL['forest']
            rgb[y - 2, x - 1] = PAL['forest_hi']

    rgb[river] = PAL['river']
    return rgb


def draw_line(rgb, pts, colour, width=1):
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        n = int(max(abs(bx - ax), abs(by - ay))) * 2 + 1
        for t in np.linspace(0, 1, n):
            x, y = int(round(ax + (bx - ax) * t)), int(round(ay + (by - ay) * t))
            for dy in range(-(width // 2), width // 2 + 1):
                for dx in range(-(width // 2), width // 2 + 1):
                    if 0 <= x + dx < W and 0 <= y + dy < H:
                        rgb[y + dy, x + dx] = colour


def smooth_path(pts, passes=4):
    """Chaikin corner-cutting. Stays inside the authored waypoints, so a trail
    curves through terrain instead of ballooning away from it."""
    path = [tuple(map(float, q)) for q in pts]
    for _ in range(passes):
        out = [path[0]]
        for (ax, ay), (bx, by) in zip(path[:-1], path[1:]):
            out.append((ax + 0.25 * (bx - ax), ay + 0.25 * (by - ay)))
            out.append((ax + 0.75 * (bx - ax), ay + 0.75 * (by - ay)))
        out.append(path[-1])
        path = out
    return path


# ---------------------------------------------------------------------------
# Landmarks — hand-placed, because this is what makes terrain a somewhere
# ---------------------------------------------------------------------------

def px(rgb, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        rgb[y, x] = c


def rect(rgb, x, y, w, h, c):
    for j in range(h):
        for i in range(w):
            px(rgb, x + i, y + j, c)


def stamp_city(rgb, cx, cy):
    """A walled city-state: curtain wall, towers, gate, lit windows."""
    wall, stone, lit, dark = PAL['wall'], PAL['stone_hi'], PAL['lit'], PAL['cliff']
    x0, y0, w, h = cx - 26, cy - 15, 52, 26
    for i in range(w):                      # curtain wall with crenellations
        px(rgb, x0 + i, y0, stone if i % 3 else wall)
        px(rgb, x0 + i, y0 + h, wall)
    for j in range(h):
        px(rgb, x0, y0 + j, wall); px(rgb, x0 + w - 1, y0 + j, wall)
    for tx in (x0, x0 + 16, x0 + 33, x0 + w - 5):   # towers
        rect(rgb, tx, y0 - 6, 5, 8, wall)
        rect(rgb, tx + 1, y0 - 7, 3, 1, stone)
        px(rgb, tx + 2, y0 - 3, lit)
    rect(rgb, cx - 3, y0 + h - 6, 6, 6, dark)       # gate
    px(rgb, cx, y0 + h - 3, lit)
    for j in range(4):                              # inner keep
        rect(rgb, cx - 8 + j, y0 + 6 + j, 16 - 2 * j, 2, stone if j % 2 else wall)
    for (dx, dy) in [(-14, 8), (-6, 10), (6, 9), (13, 11), (-10, 14), (8, 14)]:
        rect(rgb, cx + dx, cy + dy - 6, 4, 4, PAL['timber'])
        px(rgb, cx + dx + 1, cy + dy - 5, lit)


def stamp_stones(rgb, cx, cy):
    """A standing-stone ring in a clearing — the origin."""
    stone, hi, sh = PAL['stone'], PAL['stone_hi'], PAL['cliff']
    ring = [(-14, 4), (-9, -4), (0, -8), (9, -5), (14, 3), (8, 8), (-1, 10), (-9, 8)]
    for i, (dx, dy) in enumerate(ring):
        h = 7 if i % 2 == 0 else 5
        rect(rgb, cx + dx, cy + dy - h, 3, h, stone)
        px(rgb, cx + dx, cy + dy - h, hi)
        px(rgb, cx + dx + 2, cy + dy - 1, sh)
    px(rgb, cx, cy + 1, PAL['gold_dim'])


def stamp_cairn(rgb, cx, cy):
    """Stacked cairns on the high western ridge."""
    stone, hi = PAL['stone'], PAL['stone_hi']
    for (ox, base) in [(-9, 0), (0, -3), (9, 1)]:
        for k, wdt in enumerate((7, 5, 3, 1)):
            rect(rgb, cx + ox - wdt // 2, cy + base - k * 2, wdt, 2, stone if k % 2 else hi)


def stamp_terraces(rgb, cx, cy):
    """Cut terraces stepping down the eastern slope."""
    stone, hi = PAL['stone'], PAL['stone_hi']
    for k in range(5):
        y = cy - 10 + k * 5
        wdt = 30 - k * 4
        for i in range(wdt):
            px(rgb, cx - wdt // 2 + i, y, hi if i % 4 else stone)
        for i in range(wdt // 2):
            px(rgb, cx - wdt // 2 + i * 2, y + 1, PAL['cliff'])


def stamp_settlement(rgb, cx, cy):
    """Huts along a river crossing, with a timber bridge."""
    timber, lit, stone = PAL['timber'], PAL['lit'], PAL['stone_hi']
    for (dx, dy) in [(-13, -2), (-5, 3), (4, -4), (11, 2), (-9, 8), (3, 9)]:
        rect(rgb, cx + dx, cy + dy, 6, 5, timber)
        for i in range(7):
            px(rgb, cx + dx - 1 + i, cy + dy - 1, stone)
        px(rgb, cx + dx + 2, cy + dy + 2, lit)
    for i in range(16):                      # bridge
        px(rgb, cx - 8 + i, cy + 15, timber)
        if i % 3 == 0:
            px(rgb, cx - 8 + i, cy + 16, PAL['cliff'])


def stamp_grove(rgb, cx, cy):
    """An orchard: ordered rows, unlike wild forest."""
    for row in range(3):
        for col in range(5):
            x = cx - 18 + col * 9 + (row % 2) * 4
            y = cy - 8 + row * 8
            rect(rgb, x, y, 3, 3, PAL['forest_hi'])
            px(rgb, x + 1, y + 3, PAL['timber'])
            px(rgb, x, y, PAL['grass_hi'])


def stamp_marsh(rgb, cx, cy, rng):
    """Standing water, reeds and a leaning shrine in the basin."""
    for _ in range(70):
        x = cx + int(rng.integers(-30, 31)); y = cy + int(rng.integers(-22, 23))
        if rng.random() < 0.5:
            rect(rgb, x, y, int(rng.integers(2, 6)), 1, PAL['river'])
        else:
            px(rgb, x, y, PAL['forest'])
            px(rgb, x, y - 1, PAL['forest'])
    for k in range(6):                        # leaning shrine posts
        px(rgb, cx - 2 + k // 3, cy - 6 + k, PAL['timber'])
    rect(rgb, cx - 5, cy - 8, 9, 2, PAL['timber'])


def stamp_lighthouse(rgb, cx, cy):
    tower, stone, lit = PAL['stone'], PAL['stone_hi'], PAL['lit']
    rect(rgb, cx - 3, cy - 16, 6, 16, tower)
    for j in range(0, 16, 4):
        rect(rgb, cx - 3, cy - 16 + j, 6, 1, stone)
    rect(rgb, cx - 4, cy - 19, 8, 3, stone)
    rect(rgb, cx - 2, cy - 18, 4, 1, lit)
    for i in range(5):                        # beam
        px(rgb, cx + 5 + i * 2, cy - 20 - i, PAL['gold_dim'])


LANDMARKS = {
    'city': stamp_city, 'stones': stamp_stones, 'cairn': stamp_cairn,
    'terraces': stamp_terraces, 'settlement': stamp_settlement,
    'grove': stamp_grove, 'lighthouse': stamp_lighthouse,
}


def stamp_landmarks(rgb, rng):
    for r in REGIONS:
        cx, cy = r.centre
        if r.landmark == 'marsh':
            stamp_marsh(rgb, cx, cy, rng)
        else:
            LANDMARKS[r.landmark](rgb, cx, cy)
