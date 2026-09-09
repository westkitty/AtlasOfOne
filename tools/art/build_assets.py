"""
Build the Atlas runtime art pack.

One command produces everything the app loads at runtime, deterministically:
the island's three reveal states derived from a single master render, the eight
region masks, the cleaned Greyson frames, and the manifest that is the only
wiring authority. Re-running it reproduces byte-identical output.

    python3 tools/art/build_assets.py

Outputs to public/assets/atlas/v3/.
"""

from __future__ import annotations
import hashlib, json, os, shutil, sys, glob
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import world_gen as g
import char_clean as cc

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'assets', 'atlas', 'v3')
CHAR_SRC = os.environ.get('GREYSON_SRC', os.path.join(ROOT, 'greyson_runtime_character_v2.zip'))
PACK_VERSION = 'atlas-v3'


def sha256(path):
    return hashlib.sha256(open(path, 'rb').read()).hexdigest()


def save(img: Image.Image, rel: str, index: dict):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, optimize=True)
    index[rel] = {'sha256': sha256(path), 'bytes': os.path.getsize(path), 'size': list(img.size)}
    return rel


# ---------------------------------------------------------------------------
# World
# ---------------------------------------------------------------------------

def build_world(index):
    rng = np.random.default_rng(g.SEED)
    land, mask, elev, _ = g.build_height(rng)
    river = g.carve_rivers(elev, mask, rng)

    master = g.render_terrain(mask, elev, river, rng)
    master = g.apply_region_character(master, mask, elev, river, rng)
    g.stamp_landmarks(master, rng)
    master = g.apply_lantern_light(master, mask, rng)

    sea = master.copy()
    sea[mask] = g.PAL['sea_deep']

    def derive(state):
        a = master.astype(float)
        if state == 'revealed':
            rgb = a
        elif state == 'glimpsed':
            rgb = a * 0.52 + np.array(g.PAL['sea_mid']) * 0.48
        else:
            rgb = a * 0.15 + np.array(g.PAL['sea_mid']) * 0.85
        img = np.clip(rgb, 0, 255).astype(np.uint8)
        img[~mask] = master[~mask]          # the sea is the same in every state
        return img

    layers = {}
    for state in ('hidden', 'glimpsed', 'revealed'):
        layers[state] = save(Image.fromarray(derive(state)).convert('RGB'), f'world/island-{state}.png', index)
    layers['sea'] = save(Image.fromarray(sea).convert('RGB'), 'world/sea.png', index)

    # Region masks: a soft Voronoi over ONE island, so no polygon edge is ever
    # visible where two regions meet.
    yy, xx = np.mgrid[0:g.H, 0:g.W].astype(float)
    centres = [(r.id, r.centre) for r in g.REGIONS]
    masks = {}
    for rid, (cx, cy) in centres:
        own = np.hypot(xx - cx, yy - cy)
        others = np.min([np.hypot(xx - ox, yy - oy) for oid, (ox, oy) in centres if oid != rid], axis=0)
        m = np.clip((others - own) / 26.0 + 0.5, 0, 1) * mask
        img = Image.fromarray((m * 255).astype(np.uint8), mode='L')
        masks[rid] = save(img, f'world/masks/{rid}.png', index)

    regions = [{
        'id': r.id, 'label': r.label, 'centre': list(r.centre), 'stand': list(r.stand),
        'landmark': r.landmark, 'mask': masks[r.id],
    } for r in g.REGIONS]

    trails = [{
        'from': a, 'to': b, 'sea': bool(sea_route),
        # Waypoints the runtime walks Greyson along, so travel follows the route
        # rather than cutting across terrain.
        'waypoints': [[round(x, 1), round(y, 1)] for x, y in g.smooth_path(pts, passes=3)],
    } for a, b, pts, sea_route in g.TRAILS]

    return {'width': g.W, 'height': g.H, 'layers': layers, 'regions': regions, 'trails': trails}


# ---------------------------------------------------------------------------
# Character
# ---------------------------------------------------------------------------

ANIMATIONS = {
    'idle-front': (4, 4), 'idle-back': (4, 4), 'idle-left': (4, 4),
    'idle-qfront-left': (4, 4), 'idle-qback-left': (4, 4),
    'walk-front': (8, 10), 'walk-back': (8, 10), 'walk-left': (8, 10),
}
IDLE_FAMILIES = [k for k in ANIMATIONS if k.startswith('idle')]


def build_character(index, workdir):
    src = os.path.join(workdir, 'greyson')
    frames = sorted(p for p in glob.glob(f'{src}/*.png') if 'portrait' not in p)
    if not frames:
        raise SystemExit(f'no character frames found in {src}')

    raw = {os.path.basename(p): cc.load_rgba(p) for p in frames}
    cleaned, removed, pockets = {}, 0, 0
    for name, arr in raw.items():
        a, r = cc.keep_main_figure(arr); removed += r
        a, b = cc.remove_black_pockets(a); pockets += b
        a, r2 = cc.keep_main_figure(cc.despeckle_edge(a)); removed += r2
        cleaned[name] = a

    palette = cc.build_palette(list(cleaned.values()))
    final = {}
    for name, arr in cleaned.items():
        q = cc.polish_edges(cc.quantize(arr, palette))
        q, _ = cc.keep_main_figure(q)
        final[name] = cc.align(q, target_bottom=63)

    # The source ships four identical frames per idle; author a real breath.
    for family in IDLE_FAMILIES:
        base = final[f'{family}-00.png']
        for phase in range(4):
            final[f'{family}-{phase:02d}.png'] = cc.breathe(base, phase)

    for name, arr in final.items():
        save(Image.fromarray(arr), f'greyson/{name}', index)

    portrait_src = os.path.join(src, 'portrait-neutral.png')
    if os.path.exists(portrait_src):
        p, _ = cc.keep_main_figure(cc.load_rgba(portrait_src))
        save(Image.fromarray(cc.polish_edges(cc.quantize(cc.despeckle_edge(p), palette))),
             'greyson/portrait-neutral.png', index)

    baselines = {cc.anchor_stats(a)['bottom'] for a in final.values()}
    colours = [len(set(map(tuple, a[a[..., 3] > 128][:, :3].tolist()))) for a in final.values()]

    return {
        'frame': [48, 64],
        'anchor': 'bottom-centre',
        'animations': {
            name: {'frames': n, 'fps': fps, 'loop': True,
                   'src': f'greyson/{name}-{{n}}.png',
                   'still': f'greyson/{name}-00.png'}
            for name, (n, fps) in ANIMATIONS.items()
        },
        'mirrors': {'right': 'left', 'qfront-right': 'qfront-left', 'qback-right': 'qback-left'},
        'portrait': 'greyson/portrait-neutral.png',
    }, {
        'sourceFrames': len(raw), 'detachedPixelsRemoved': removed,
        'blackPocketPixelsCleared': pockets, 'paletteSize': int(len(set(map(tuple, palette.tolist())))),
        'coloursPerFrame': [min(colours), max(colours)],
        'footBaselines': sorted(baselines),
        'idleAuthored': IDLE_FAMILIES,
    }


def main():
    workdir = os.environ.get('ART_WORK')
    if not workdir:
        raise SystemExit('set ART_WORK to the directory holding cleaned/ source greyson frames')
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)

    index = {}
    world = build_world(index)
    character, qa = build_character(index, workdir)

    manifest = {
        'schemaVersion': 1,
        'assetPackVersion': PACK_VERSION,
        'base': '/assets/atlas/v3/',
        'world': world,
        'character': character,
        'files': index,
    }
    with open(os.path.join(OUT, 'manifest.json'), 'w') as fh:
        json.dump(manifest, fh, indent=1, sort_keys=True)

    # The same manifest, emitted as a typed module. The app imports this rather
    # than fetching JSON: coordinates are then available on the first paint, with
    # no loading state and nothing extra to cache for offline use. The images
    # themselves are still ordinary static assets.
    ts = os.path.join(ROOT, 'src', 'world', 'manifest.generated.ts')
    with open(ts, 'w') as fh:
        fh.write('/* GENERATED by tools/art/build_assets.py — do not edit by hand. */\n')
        fh.write('/* Rebuild with: npm run art:build */\n\n')
        fh.write('export const ATLAS_MANIFEST = ')
        fh.write(json.dumps({k: v for k, v in manifest.items() if k != 'files'}, indent=2, sort_keys=True))
        fh.write(' as const;\n\nexport type AtlasManifest = typeof ATLAS_MANIFEST;\n')
    print('wrote', os.path.relpath(ts, ROOT))

    total = sum(v['bytes'] for v in index.values())
    print(f'wrote {len(index)} files, {total/1024:.1f} KiB -> {OUT}')
    print('character QA:', json.dumps(qa))
    return manifest


if __name__ == '__main__':
    main()
