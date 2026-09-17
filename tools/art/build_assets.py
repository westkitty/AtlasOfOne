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


def save_raw(src_path: str, rel: str, index: dict):
    """
    Copy a source file's bytes verbatim, with no PIL re-encode.

    save() always round-trips through Image.save(optimize=True), which can
    change a PNG's compressed bytes even when every pixel is unchanged (a
    different filter/compression choice). For inputs that are already final
    -- the committed vault/ui/effects assets, or Greyson frames staged from
    the committed canon -- that churn is pure noise, so this copies the file
    directly and only opens it with PIL to read its pixel dimensions.
    """
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    shutil.copy2(src_path, path)
    with Image.open(path) as img:
        size = list(img.size)
    index[rel] = {'sha256': sha256(path), 'bytes': os.path.getsize(path), 'size': size}
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
        m8 = (m * 255).astype(np.uint8)
        rgba = np.dstack([np.full_like(m8, 255), np.full_like(m8, 255), np.full_like(m8, 255), m8])
        masks[rid] = save(Image.fromarray(rgba, mode='RGBA'), f'world/masks/{rid}.png', index)

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
    'walk-qfront-left': (8, 10), 'walk-qback-left': (8, 10),
    'arrive-front': (4, 6), 'arrive-back': (4, 6), 'arrive-left': (4, 6),
    'think-front': (6, 5), 'sit-left': (4, 3), 'discover-front': (6, 7),
    'look-up-back': (4, 4),
}
IDLE_FAMILIES = [k for k in ANIMATIONS if k.startswith('idle')]

# (fps, loop) per effects family -- the playback rate/looping the runtime
# uses; frame count and pixel size are derived from the staged PNGs.
EFFECTS = {
    'coordinate-mark': (10, False),
    'fog-lift': (12, False),
    'landmark-glow': (6, True),
    'marker-here': (4, True),
    'trail-light': (10, False),
}


def _is_precleaned(frames: dict) -> bool:
    """
    True when every frame is already the final 48x64 canvas with a binary
    {0,255} alpha channel -- i.e. it was cleaned/quantized upstream (staged
    verbatim from the committed public/assets/atlas/v3/greyson/ canon) rather
    than being a raw art export.
    """
    for arr in frames.values():
        if arr.shape[:2] != (64, 48):     # numpy (H, W, C); PIL size is (48, 64)
            return False
        alpha = arr[..., 3]
        if not np.all((alpha == 0) | (alpha == 255)):
            return False
    return True


def build_character(index, workdir):
    """
    Two source modes, auto-detected from the staged frames:

    - Pre-cleaned mode: the source is already the committed canon (every
      frame already the final 48x64 canvas with binary alpha, including the
      already-authored idle breathing phases). char_clean's k-means palette
      is built fresh from whatever frame set is fed to it, so re-running
      keep_main_figure/quantize/breathe against already-cleaned frames does
      not reproduce them -- it just drifts the palette away from canon. So
      pre-cleaned frames and portraits are copied byte-for-byte with
      save_raw, skipping cleaning/quantize/breathe entirely; QA stats are
      measured directly off the loaded arrays instead of the pipeline's own
      counters.

    - Raw mode (unchanged): the source is an unprocessed art export (e.g. the
      v2 zip or the artpack's greyson-artpack/, kept for reference) and goes
      through the full keep_main_figure -> despeckle -> quantize ->
      polish_edges -> align -> breathe pipeline in char_clean.py.
    """
    src = os.path.join(workdir, 'greyson')
    frames = sorted(p for p in glob.glob(f'{src}/*.png') if 'portrait' not in p)
    if not frames:
        raise SystemExit(f'no character frames found in {src}')

    raw = {os.path.basename(p): cc.load_rgba(p) for p in frames}

    if _is_precleaned(raw):
        for name in raw:
            save_raw(os.path.join(src, name), f'greyson/{name}', index)

        portraits = {}
        for emo in ['neutral', 'serious', 'warm', 'wry']:
            portrait_src = os.path.join(src, f'portrait-{emo}.png')
            if os.path.exists(portrait_src):
                save_raw(portrait_src, f'greyson/portrait-{emo}.png', index)
                portraits[emo] = f'greyson/portrait-{emo}.png'

        baselines = {cc.anchor_stats(a)['bottom'] for a in raw.values()}
        colours = [len(set(map(tuple, a[a[..., 3] > 128][:, :3].tolist()))) for a in raw.values()]
        all_colours = set()
        for a in raw.values():
            all_colours.update(map(tuple, a[a[..., 3] > 128][:, :3].tolist()))

        qa = {
            'sourceFrames': len(raw), 'detachedPixelsRemoved': 0,
            'blackPocketPixelsCleared': 0, 'paletteSize': len(all_colours),
            'coloursPerFrame': [min(colours), max(colours)],
            'footBaselines': sorted(baselines),
            'idleAuthored': IDLE_FAMILIES,
        }
    else:
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
            if f'{family}-00.png' in final:
                base = final[f'{family}-00.png']
                for phase in range(4):
                    final[f'{family}-{phase:02d}.png'] = cc.breathe(base, phase)

        for name, arr in final.items():
            save(Image.fromarray(arr), f'greyson/{name}', index)

        portraits = {}
        for emo in ['neutral', 'serious', 'warm', 'wry']:
            portrait_src = os.path.join(src, f'portrait-{emo}.png')
            if os.path.exists(portrait_src):
                p, _ = cc.keep_main_figure(cc.load_rgba(portrait_src))
                save(Image.fromarray(cc.polish_edges(cc.quantize(cc.despeckle_edge(p), palette))),
                     f'greyson/portrait-{emo}.png', index)
                portraits[emo] = f'greyson/portrait-{emo}.png'

        baselines = {cc.anchor_stats(a)['bottom'] for a in final.values()}
        colours = [len(set(map(tuple, a[a[..., 3] > 128][:, :3].tolist()))) for a in final.values()]

        qa = {
            'sourceFrames': len(raw), 'detachedPixelsRemoved': removed,
            'blackPocketPixelsCleared': pockets, 'paletteSize': int(len(set(map(tuple, palette.tolist())))),
            'coloursPerFrame': [min(colours), max(colours)],
            'footBaselines': sorted(baselines),
            'idleAuthored': IDLE_FAMILIES,
        }

    return {
        'frame': [48, 64],
        'anchor': 'bottom-centre',
        'animations': {
            name: {'frames': n, 'fps': fps, 'loop': not name.startswith('arrive') and not name.startswith('discover'),
                   'src': f'greyson/{name}-{{n}}.png',
                   'still': f'greyson/{name}-00.png'}
            for name, (n, fps) in ANIMATIONS.items()
        },
        'mirrors': {'right': 'left', 'qfront-right': 'qfront-left', 'qback-right': 'qback-left'},
        'portrait': 'greyson/portrait-neutral.png',
        'portraits': portraits,
    }, qa


def build_extra_assets(index, workdir):
    vault = {}
    vault_src = os.path.join(workdir, 'vault') if workdir and os.path.isdir(os.path.join(workdir, 'vault')) else None
    if vault_src:
        for p in sorted(glob.glob(f'{vault_src}/*.png')):
            name = os.path.basename(p)
            save_raw(p, f'vault/{name}', index)
            frag_id = name.replace('fragment-', '').replace('.png', '')
            vault[frag_id] = f'vault/{name}'

    ui = {'glyphs': {}, 'icons': {}}
    ui_src = os.path.join(workdir, 'ui') if workdir and os.path.isdir(os.path.join(workdir, 'ui')) else None
    if ui_src:
        for p in sorted(glob.glob(f'{ui_src}/*.png')):
            name = os.path.basename(p)
            save_raw(p, f'ui/{name}', index)
            base = name.replace('.png', '')
            if 'icon-' in base:
                ui['icons'][base.replace('icon-', '')] = f'ui/{name}'
            elif base == 'cold-open-mark':
                ui['icons']['cold_open'] = f'ui/{name}'
            else:
                ui['glyphs'][base] = f'ui/{name}'

    # Effects are a build stage, not orphans: mirror the vault loop, grouping
    # frames by family (marker-here, landmark-glow, trail-light,
    # coordinate-mark, fog-lift) so main() no longer has to rmtree() a
    # directory nothing here reproduces.
    effects = {}
    effects_src = os.path.join(workdir, 'effects') if workdir and os.path.isdir(os.path.join(workdir, 'effects')) else None
    if effects_src:
        counts: dict[str, int] = {}
        first_frame: dict[str, str] = {}
        for p in sorted(glob.glob(f'{effects_src}/*.png')):
            name = os.path.basename(p)
            save_raw(p, f'effects/{name}', index)
            family = name[:-len('.png')].rsplit('-', 1)[0]
            counts[family] = counts.get(family, 0) + 1
            first_frame.setdefault(family, p)
        for family, n in sorted(counts.items()):
            fps, loop = EFFECTS[family]
            with Image.open(first_frame[family]) as img:
                size = list(img.size)
            effects[family] = {'fps': fps, 'frames': n, 'loop': loop, 'size': size, 'src': f'effects/{family}-{{n}}.png'}

    return vault, ui, effects


def main():
    workdir = os.environ.get('ART_WORK')
    if not workdir:
        raise SystemExit('set ART_WORK to the directory holding cleaned/ source greyson frames')
    # README.md is hand-written documentation living in OUT, not a build
    # product, so it has to survive the rmtree below rather than being
    # silently deleted on every run.
    readme = os.path.join(OUT, 'README.md')
    readme_bytes = open(readme, 'rb').read() if os.path.isfile(readme) else None
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)
    if readme_bytes is not None:
        with open(readme, 'wb') as fh:
            fh.write(readme_bytes)

    index = {}
    world = build_world(index)
    character, qa = build_character(index, workdir)
    vault, ui, effects = build_extra_assets(index, workdir)

    manifest = {
        'schemaVersion': 1,
        'assetPackVersion': PACK_VERSION,
        'base': '/assets/atlas/v3/',
        'world': world,
        'character': character,
        'vault': {'fragments': vault} if vault else {},
        'ui': ui if ui['glyphs'] else {},
        'effects': effects,
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
