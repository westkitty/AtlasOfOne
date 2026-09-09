"""
Greyson character restoration.

The v2 source has the right likeness but carries generated-image residue: up to
3333 unique colours in a 48x64 frame, detached coloured specks around every
silhouette, and five "animations" that are four byte-identical copies of one
pose.

This pipeline is deterministic — same input, same output, every run — and does
four things, in order:

  1. keep only the connected figure, dropping detached speckle
  2. median-filter the silhouette edge, killing colour fringe
  3. quantize to ONE curated palette shared by every frame
  4. normalise the anchor so the character does not jitter between frames

It deliberately does NOT rescale anything. Resampling is what corrupted the
previous asset generation, so frames are only ever translated.
"""

from __future__ import annotations
import numpy as np
from PIL import Image
from scipy import ndimage

# The canonical colours from public/assets/greyson/palette.txt. These are seeded
# into the palette so quantization can never drift Greyson's identity.
ANCHORS = [
    (227, 176, 144),  # skin
    (188, 138, 110),  # skin shadow
    (44, 34, 28),     # hair / beard
    (26, 20, 16),     # hair shadow
    (117, 115, 113),  # hoodie grey
    (86, 84, 83),     # hoodie shadow
    (150, 148, 146),  # hoodie highlight
    (201, 169, 135),  # sherpa lining
    (29, 29, 29),     # cap black
    (16, 16, 16),     # cap shadow
    (208, 45, 56),    # underwear red
    (150, 32, 40),    # underwear red shadow
    (51, 70, 114),    # underwear blue
    (36, 50, 82),     # underwear blue shadow
]
PALETTE_SIZE = 44


def load_rgba(path):
    return np.array(Image.open(path).convert('RGBA'))


def keep_main_figure(rgba, min_keep=6):
    """
    Drop everything not part of the character.

    Greyson is one connected figure, so any opaque island floating off the
    silhouette is generated-image garbage by definition. Internal detail — eyes,
    the cap logo, highlights — sits inside the body component and is untouched.
    """
    alpha = rgba[..., 3] > 128
    labels, count = ndimage.label(alpha, structure=np.ones((3, 3)))
    if count <= 1:
        return rgba, 0
    sizes = ndimage.sum(alpha, labels, range(1, count + 1))
    main = int(np.argmax(sizes)) + 1
    removed = int(alpha.sum() - sizes[main - 1])
    out = rgba.copy()
    out[(labels != main) & (labels != 0)] = (0, 0, 0, 0)
    return out, removed


def despeckle_edge(rgba, passes=2):
    """
    Replace boundary pixels that disagree violently with their neighbours.

    Generated art leaves saturated red/green/cyan fringe one pixel wide along the
    silhouette. A median over the opaque neighbourhood removes it without
    touching interior shading.
    """
    out = rgba.copy()
    for _ in range(passes):
        alpha = out[..., 3] > 128
        eroded = ndimage.binary_erosion(alpha, np.ones((3, 3)))
        edge = alpha & ~eroded
        ys, xs = np.nonzero(edge)
        rgb = out[..., :3].astype(int)
        for y, x in zip(ys, xs):
            y0, y1 = max(0, y - 1), min(out.shape[0], y + 2)
            x0, x1 = max(0, x - 1), min(out.shape[1], x + 2)
            block = rgb[y0:y1, x0:x1]
            mask = alpha[y0:y1, x0:x1]
            neigh = block[mask]
            if len(neigh) < 3:
                continue
            med = np.median(neigh, axis=0)
            if np.abs(rgb[y, x] - med).sum() > 140:
                out[y, x, :3] = med.astype(np.uint8)
    return out


def build_palette(frames, size=PALETTE_SIZE, iterations=24):
    """
    One palette for the whole character, built by deterministic k-means.

    The canonical anchors are seeded as fixed starting centroids and are never
    displaced, so skin, hoodie, cap and underwear stay exactly on-model while the
    remaining slots absorb whatever shading the source actually uses.
    """
    pixels = np.concatenate([f[f[..., 3] > 128][:, :3].astype(float) for f in frames])
    anchors = np.array(ANCHORS, dtype=float)
    rng = np.random.default_rng(7)
    extra = size - len(anchors)
    idx = rng.choice(len(pixels), size=extra, replace=False)
    centroids = np.vstack([anchors, pixels[idx]])

    for _ in range(iterations):
        d = ((pixels[:, None, :] - centroids[None, :, :]) ** 2).sum(axis=2)
        assign = d.argmin(axis=1)
        for k in range(len(anchors), size):          # anchors stay put
            sel = pixels[assign == k]
            if len(sel):
                centroids[k] = sel.mean(axis=0)
    return np.round(centroids).astype(int)


def quantize(rgba, palette):
    out = rgba.copy()
    mask = out[..., 3] > 128
    px = out[mask][:, :3].astype(int)
    d = ((px[:, None, :] - palette[None, :, :]) ** 2).sum(axis=2)
    out[mask, :3] = palette[d.argmin(axis=1)].astype(np.uint8)
    out[..., 3] = np.where(mask, 255, 0).astype(np.uint8)   # binary alpha
    return out


def anchor_stats(rgba):
    op = rgba[..., 3] > 128
    ys, xs = np.nonzero(op)
    if not len(ys):
        return None
    return {'bottom': int(ys.max()), 'centre': float(xs.mean()),
            'left': int(xs.min()), 'right': int(xs.max()), 'top': int(ys.min())}


def align(rgba, target_bottom=63, target_centre=None):
    """Translate only — never rescale — so the figure sits on a fixed baseline."""
    st = anchor_stats(rgba)
    if st is None:
        return rgba
    dy = target_bottom - st['bottom']
    dx = 0 if target_centre is None else int(round(target_centre - st['centre']))
    if dx == 0 and dy == 0:
        return rgba
    out = np.zeros_like(rgba)
    h, w = rgba.shape[:2]
    ys0, ys1 = max(0, dy), min(h, h + dy)
    xs0, xs1 = max(0, dx), min(w, w + dx)
    out[ys0:ys1, xs0:xs1] = rgba[ys0 - dy:ys1 - dy, xs0 - dx:xs1 - dx]
    return out


def breathe(rgba, phase):
    """
    Author a real idle from a static pose.

    The source ships four identical frames per idle. Rather than pretend that is
    animation, this lifts a narrow band of the upper torso by one pixel and lets
    the shoulders settle back — a breath. Feet, legs and the anchor never move,
    so the character does not bob.

    phase 0 = neutral (also the reduced-motion still), 1 = inhale, 2 = hold,
    3 = release.
    """
    if phase == 0:
        return rgba.copy()
    lift = {1: 1, 2: 1, 3: 0}[phase]
    if lift == 0:
        return rgba.copy()
    out = rgba.copy()
    op = rgba[..., 3] > 128
    ys, xs = np.nonzero(op)
    top, bottom = ys.min(), ys.max()
    # The chest band only: below the head, above the waist.
    band0 = top + int((bottom - top) * 0.28)
    band1 = top + int((bottom - top) * 0.52)
    seg = rgba[band0:band1].copy()
    out[band0 - lift:band1 - lift] = seg
    # Re-close the seam the lift opens under the band.
    out[band1 - lift:band1 + 1] = rgba[band1 - lift:band1 + 1]
    if phase == 2:
        # A one-pixel shoulder settle, so hold differs from inhale.
        sh = out[band0 - lift:band0 + 2].copy()
        out[band0 - lift + 1:band0 + 3] = sh
    return out


def remove_black_pockets(rgba, min_size=18):
    """
    Kill enclosed black voids left by an incomplete background flood-fill.

    The v2 source was cut from a black-background sheet, and the fill could not
    reach pockets sealed by the figure — walk-left carries a solid black wedge
    between the legs. Those pockets are connected to the body, so component
    isolation cannot see them; they are found by colour and position instead.

    The cap is also near-black, so anything in the upper half of the frame is
    left strictly alone.
    """
    out = rgba.copy()
    op = out[..., 3] > 128
    rgb = out[..., :3].astype(int)
    black = op & (rgb.sum(axis=2) < 34)
    guard = np.zeros_like(black)
    guard[: int(rgba.shape[0] * 0.55)] = True        # cap / hair territory
    black = black & ~guard
    labels, n = ndimage.label(black, structure=np.ones((3, 3)))
    fixed = 0
    for k in range(1, n + 1):
        sel = labels == k
        if sel.sum() < min_size:
            continue
        out[sel] = (0, 0, 0, 0)
        fixed += int(sel.sum())
    return out, fixed


def polish_edges(rgba, passes=2, rarity=2):
    """
    Final fringe pass, run AFTER quantization.

    Median filtering removes extreme fringe but leaves speckle that is
    chromatically close to skin — the stray red and olive pixels along arms,
    legs and feet. Those pixels are identifiable a different way: on a clean
    pixel-art edge a colour is shared with its neighbours, so an edge pixel
    whose own colour appears once or twice in its 3x3 neighbourhood is noise.
    It is replaced with the local majority.

    Interior detail is never touched, so the cap logo, eyes and the tattoo
    survive regardless of how few pixels they occupy.
    """
    out = rgba.copy()
    for _ in range(passes):
        alpha = out[..., 3] > 128
        edge = alpha & ~ndimage.binary_erosion(alpha, np.ones((3, 3)))
        rgb = out[..., :3]
        ys, xs = np.nonzero(edge)
        for y, x in zip(ys, xs):
            y0, y1 = max(0, y - 1), min(out.shape[0], y + 2)
            x0, x1 = max(0, x - 1), min(out.shape[1], x + 2)
            block = rgb[y0:y1, x0:x1].reshape(-1, 3)
            live = alpha[y0:y1, x0:x1].reshape(-1)
            neigh = [tuple(c) for c, k in zip(block.tolist(), live) if k]
            if len(neigh) < 4:
                continue
            mine = tuple(rgb[y, x].tolist())
            if neigh.count(mine) > rarity:
                continue
            counts = {}
            for c in neigh:
                if c != mine:
                    counts[c] = counts.get(c, 0) + 1
            if counts:
                out[y, x, :3] = max(counts.items(), key=lambda kv: kv[1])[0]
    return out
