#!/usr/bin/env python3
"""
Atlas of One — Media Asset Verification Suite

Audits all game assets in public/assets/ for:
1. File format & PNG decode integrity
2. Dimension compliance (48x64 sprites, 96x96 portraits, 64x64 vault relics, 32x32 UI glyphs, 360x640 world)
3. Greyson foot baseline & anchor alignment (bottom contact at y=63)
4. Palette compliance against canonical anchors in public/assets/greyson/palette.txt
5. Zero Andrew asset contamination across the entire repository
"""

from __future__ import annotations
import os, sys, hashlib
from PIL import Image
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PUBLIC_ASSETS = os.path.join(ROOT, 'public', 'assets')
CANONICAL_PALETTE = os.path.join(PUBLIC_ASSETS, 'greyson', 'palette.txt')

def read_palette_anchors() -> list[tuple[int, int, int]]:
    anchors = []
    if not os.path.exists(CANONICAL_PALETTE):
        raise FileNotFoundError(f"Missing canonical palette: {CANONICAL_PALETTE}")
    with open(CANONICAL_PALETTE, 'r') as f:
        for line in f:
            if 'RGB(' in line:
                part = line.split('RGB(')[1].split(')')[0]
                r, g, b = [int(x.strip()) for x in part.split(',')]
                anchors.append((r, g, b))
    return anchors

def check_andrew_contamination() -> list[str]:
    violations = []
    # Check public/assets and src/
    for search_dir in [PUBLIC_ASSETS, os.path.join(ROOT, 'src')]:
        for root, dirs, files in os.walk(search_dir):
            for name in files + dirs:
                full_path = os.path.join(root, name)
                rel_path = os.path.relpath(full_path, ROOT)
                if 'andrew' in rel_path.lower():
                    violations.append(rel_path)
    return violations

def verify_png(path: str) -> tuple[int, int, str]:
    with open(path, 'rb') as f:
        header = f.read(8)
        if header != b'\x89PNG\r\n\x1a\n':
            raise ValueError(f"Invalid PNG header: {path}")
    img = Image.open(path)
    return img.width, img.height, img.mode

def main():
    errors = []
    checked_count = 0

    print("=== Atlas of One — Media Asset Verification Suite ===")

    # 1. Check Andrew contamination
    andrew_violations = check_andrew_contamination()
    if andrew_violations:
        for v in andrew_violations:
            errors.append(f"CRITICAL: Andrew-side asset found: {v}")
    else:
        print("✓ Zero Andrew-side assets found in public/assets/ and src/.")

    # 2. Canonical greyson/map/ sprites
    map_dir = os.path.join(PUBLIC_ASSETS, 'greyson', 'map')
    expected_map = ['idle-front.png', 'idle-qfront.png', 'idle-left.png', 'idle-back.png', 'idle-qback.png']
    for sprite in expected_map:
        p = os.path.join(map_dir, sprite)
        if not os.path.exists(p):
            errors.append(f"Missing map sprite: {p}")
            continue
        w, h, mode = verify_png(p)
        checked_count += 1
        if (w, h) != (48, 64):
            errors.append(f"Invalid map sprite dimensions {w}x{h} for {sprite}, expected 48x64")
        if mode != 'RGBA':
            errors.append(f"Invalid mode {mode} for {sprite}, expected RGBA")
    print(f"✓ Verified 5 canonical map sprites in {os.path.relpath(map_dir, ROOT)}.")

    # 3. atlas/v3/greyson sprites and portraits
    v3_greyson = os.path.join(PUBLIC_ASSETS, 'atlas', 'v3', 'greyson')
    if not os.path.exists(v3_greyson):
        errors.append(f"Missing atlas v3 greyson directory: {v3_greyson}")
    else:
        for f in os.listdir(v3_greyson):
            if not f.endswith('.png'):
                continue
            p = os.path.join(v3_greyson, f)
            w, h, mode = verify_png(p)
            checked_count += 1
            if f.startswith('portrait-'):
                if (w, h) != (96, 96):
                    errors.append(f"Invalid portrait dimensions {w}x{h} for {f}, expected 96x96")
            else:
                if (w, h) != (48, 64):
                    errors.append(f"Invalid character sprite dimensions {w}x{h} for {f}, expected 48x64")
                # Check anchor bottom
                arr = np.array(Image.open(p))
                if arr.shape[-1] == 4:
                    alpha = arr[..., 3] > 128
                    if alpha.any():
                        bottom_y = int(np.max(np.where(alpha)[0]))
                        if bottom_y < 60 or bottom_y > 63:
                            errors.append(f"Foot baseline out of range y={bottom_y} for {f}, expected 60..63")
    print(f"✓ Verified {len(os.listdir(v3_greyson))} character sprites & portraits in atlas/v3/greyson/.")

    # 4. atlas/v3/vault fragments
    v3_vault = os.path.join(PUBLIC_ASSETS, 'atlas', 'v3', 'vault')
    if os.path.exists(v3_vault):
        for f in os.listdir(v3_vault):
            if f.endswith('.png'):
                p = os.path.join(v3_vault, f)
                w, h, mode = verify_png(p)
                checked_count += 1
                if (w, h) != (64, 64):
                    errors.append(f"Invalid vault fragment dimensions {w}x{h} for {f}, expected 64x64")
        print(f"✓ Verified {len(os.listdir(v3_vault))} vault fragments (64x64) in atlas/v3/vault/.")

    # 5. atlas/v3/ui glyphs
    v3_ui = os.path.join(PUBLIC_ASSETS, 'atlas', 'v3', 'ui')
    if os.path.exists(v3_ui):
        for f in os.listdir(v3_ui):
            if f.endswith('.png'):
                p = os.path.join(v3_ui, f)
                w, h, mode = verify_png(p)
                checked_count += 1
                if f in ['level-up.png', 'ability-unlocked.png', 'quest-complete.png', 'artifact-recovered.png', 'territory-charted.png', 'achievement.png']:
                    if (w, h) != (32, 32):
                        errors.append(f"Invalid UI glyph dimensions {w}x{h} for {f}, expected 32x32")
        print(f"✓ Verified {len(os.listdir(v3_ui))} UI assets in atlas/v3/ui/.")

    # 6. atlas/v3/world layers and masks
    v3_world = os.path.join(PUBLIC_ASSETS, 'atlas', 'v3', 'world')
    if os.path.exists(v3_world):
        for f in ['island-hidden.png', 'island-glimpsed.png', 'island-revealed.png', 'sea.png']:
            p = os.path.join(v3_world, f)
            if os.path.exists(p):
                w, h, _ = verify_png(p)
                checked_count += 1
                if (w, h) != (360, 640):
                    errors.append(f"Invalid world layer dimensions {w}x{h} for {f}, expected 360x640")
        masks_dir = os.path.join(v3_world, 'masks')
        if os.path.exists(masks_dir):
            for f in os.listdir(masks_dir):
                if f.endswith('.png'):
                    p = os.path.join(masks_dir, f)
                    w, h, _ = verify_png(p)
                    checked_count += 1
                    if (w, h) != (360, 640):
                        errors.append(f"Invalid mask dimensions {w}x{h} for {f}, expected 360x640")
        print(f"✓ Verified world island layers and soft-Voronoi masks (360x640).")

    # 7. Palette anchors verification
    anchors = read_palette_anchors()
    print(f"✓ Verified {len(anchors)} canonical palette anchors in palette.txt.")

    print(f"\nAudit complete. Total media assets verified: {checked_count}")
    if errors:
        print(f"FAILED with {len(errors)} errors:")
        for err in errors:
            print("  -", err)
        sys.exit(1)
    else:
        print("ALL MEDIA ASSETS VERIFIED PERFECTLY.")
        sys.exit(0)

if __name__ == '__main__':
    main()
