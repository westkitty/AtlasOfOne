#!/usr/bin/env bash
# Stage art sources into ART_WORK (default .art-src) so tools/art/build_assets.py
# is reproducible from this machine. Sources never enter git.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${ART_WORK:-$ROOT/.art-src}"
WW_SRC="${WW_SRC:-/Users/andrew/Worldwalker/public/assets/runtime}"

rm -rf "$WORK"
mkdir -p "$WORK"

# Two raw Greyson zips exist (greyson_runtime_character_v2.zip: 45 base frames,
# idle x5 + walk x3 families, one portrait; atlas_of_one_artpack_v1.zip: the
# 96-file expanded set, all 17 families + 4 portraits) but NEITHER is the exact
# upstream of the committed public/assets/atlas/v3/greyson/ canon: the character
# pipeline's k-means palette (char_clean.build_palette) is built fresh from
# whichever frame set is fed to it, so re-cleaning either raw zip against that
# palette always drifts every frame away from what's already canonical (verified
# in Task 0.2 Step 4: ~10% of pixels per frame differ from HEAD even using the
# closer of the two zips). So the build's greyson/ input is staged from the
# committed canon itself, which build_assets.py's pre-cleaned-frame detection
# then copies through byte-for-byte instead of re-cleaning. The artpack's own
# greyson/ is kept only as greyson-artpack/, for reference/diffing -- it is
# never read by build_assets.py.
mkdir -p "$WORK/greyson" && cp "$ROOT"/public/assets/atlas/v3/greyson/*.png "$WORK/greyson/"

unzip -q -o "$ROOT/atlas_of_one_artpack_v1.zip" -d "$WORK/_pack"
mkdir -p "$WORK/greyson-artpack" && cp "$WORK"/_pack/greyson/*.png "$WORK/greyson-artpack/"
for d in vault ui effects; do mkdir -p "$WORK/$d" && cp "$WORK"/_pack/"$d"/*.png "$WORK/$d/"; done
unzip -q -o "$ROOT/greyson_runtime_character_v2.zip" -d "$WORK/_char"
mkdir -p "$WORK/greyson-v2" && cp "$WORK"/_char/greyson/*.png "$WORK/greyson-v2/"
rm -rf "$WORK/_char" "$WORK/_pack"

mkdir -p "$WORK/greyson-hires"
cp "$ROOT"/c4993a3c-a3d8-440e-a017-c7ece4243d8e.png "$WORK/greyson-hires/sheet-walk-portrait.png"
cp "$ROOT"/55bd567c-4fd8-4f2f-bc00-d047f5cd104f.png "$WORK/greyson-hires/idle-a.png"
cp "$ROOT"/6c44c720-d6aa-4017-a9fd-4b21d5de4861.png "$WORK/greyson-hires/idle-b.png"
cp "$ROOT"/79fe0507-d4dc-4e2e-a3ce-0ce2a003bb6c.png "$WORK/greyson-hires/idle-c.png"

# Worldwalker: copy ONLY the curated families. The traveler, hero portraits,
# terrain tiles, project landmarks and other NPCs are deliberately not staged.
mkdir -p "$WORK/worldwalker"
for f in settlement_shrine settlement_statue settlement_gate settlement_docks \
         settlement_observatory settlement_workshop settlement_swamp settlement_lighthouse \
         interior_floor_stone interior_floor_gold interior_floor_wood interior_rug_green \
         interior_rug_blue interior_wall_panel interior_bookshelf interior_bookcase \
         interior_table interior_desk interior_fireplace interior_globe interior_telescope \
         interior_door interior_crystal_blue interior_crystal_purple interior_market_stall \
         interior_lantern fx_waystone fx_torch fx_sparkle fx_crystal_glow \
         npc_cartographer portrait_cartographer; do
  cp "$WW_SRC/$f.png" "$WORK/worldwalker/$f.png"
done

# Provenance: hashes of everything staged, so the build can record them.
( cd "$WORK" && find . -type f -name '*.png' | sort | xargs shasum -a 256 ) > "$WORK/SOURCES.sha256"
echo "staged $(wc -l < "$WORK/SOURCES.sha256") source files into $WORK"
