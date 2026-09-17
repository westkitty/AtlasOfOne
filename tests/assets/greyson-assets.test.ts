import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATLAS_MANIFEST } from '../../src/world/manifest.generated';

const ASSETS_ROOT = join(process.cwd(), 'public', 'assets');
const GREYSON_ROOT = join(ASSETS_ROOT, 'greyson');
const MAP = join(GREYSON_ROOT, 'map');
const ATLAS_V3 = join(ASSETS_ROOT, 'atlas', 'v3');
const V3_GREYSON = join(ATLAS_V3, 'greyson');
const V3_VAULT = join(ATLAS_V3, 'vault');
const V3_UI = join(ATLAS_V3, 'ui');
const V3_EFFECTS = join(ATLAS_V3, 'effects');

const MAP_SPRITES = ['idle-front.png', 'idle-qfront.png', 'idle-left.png', 'idle-back.png', 'idle-qback.png'];
const PORTRAITS = ['portrait-neutral.png', 'portrait-serious.png', 'portrait-warm.png', 'portrait-wry.png'];
const VAULT_FRAGMENTS = [
  'fragment-politics.png', 'fragment-values.png', 'fragment-cognition.png',
  'fragment-identity.png', 'fragment-relationships.png', 'fragment-fears.png',
  'fragment-interests.png', 'fragment-future.png', 'fragment-empty.png'
];
const UI_GLYPHS = [
  'level-up.png', 'ability-unlocked.png', 'quest-complete.png',
  'artifact-recovered.png', 'territory-charted.png', 'achievement.png'
];
const EFFECTS_FRAME_COUNTS: Record<string, number> = {
  'coordinate-mark': 6, 'fog-lift': 8, 'landmark-glow': 4, 'marker-here': 4, 'trail-light': 6
};

function pngDimensions(path: string) {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function walk(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const next = join(path, entry.name);
    return entry.isDirectory() ? walk(next) : [next];
  });
}

describe('canonical Greyson/Aerron runtime assets', () => {
  it('ships the five exact-size game-ready sprite slots in public/assets/greyson/map', () => {
    expect(readdirSync(MAP).sort()).toEqual([...MAP_SPRITES].sort());
    for (const sprite of MAP_SPRITES) {
      expect(pngDimensions(join(MAP, sprite))).toEqual({ width: 48, height: 64 });
    }
  });

  it('ships all four 96x96 emotional dialogue portraits in atlas/v3/greyson', () => {
    for (const portrait of PORTRAITS) {
      const p = join(V3_GREYSON, portrait);
      expect(existsSync(p), `Missing portrait ${portrait}`).toBe(true);
      expect(pngDimensions(p)).toEqual({ width: 96, height: 96 });
    }
  });

  it('ships extended Greyson animations (think, sit, look-up, arrive, discover) at 48x64', () => {
    const requiredAnimationSamples = [
      'think-front-00.png', 'think-front-05.png',
      'sit-left-00.png', 'sit-left-03.png',
      'look-up-back-00.png', 'look-up-back-03.png',
      'arrive-front-00.png', 'arrive-left-00.png',
      'discover-front-00.png', 'discover-front-05.png'
    ];
    for (const file of requiredAnimationSamples) {
      const p = join(V3_GREYSON, file);
      expect(existsSync(p), `Missing animation frame ${file}`).toBe(true);
      expect(pngDimensions(p)).toEqual({ width: 48, height: 64 });
    }
  });

  it('ships the nine 64x64 vault fragments', () => {
    for (const frag of VAULT_FRAGMENTS) {
      const p = join(V3_VAULT, frag);
      expect(existsSync(p), `Missing vault fragment ${frag}`).toBe(true);
      expect(pngDimensions(p)).toEqual({ width: 64, height: 64 });
    }
  });

  it('ships the six 32x32 UI milestone glyphs', () => {
    for (const glyph of UI_GLYPHS) {
      const p = join(V3_UI, glyph);
      expect(existsSync(p), `Missing UI glyph ${glyph}`).toBe(true);
      expect(pngDimensions(p)).toEqual({ width: 32, height: 32 });
    }
  });

  it('ships the 28 effects frames as a build stage, listed in the manifest', () => {
    expect(Object.keys(ATLAS_MANIFEST.effects)).toEqual(
      ['coordinate-mark', 'fog-lift', 'landmark-glow', 'marker-here', 'trail-light']
    );
    let total = 0;
    for (const [family, count] of Object.entries(EFFECTS_FRAME_COUNTS)) {
      expect(ATLAS_MANIFEST.effects[family as keyof typeof ATLAS_MANIFEST.effects].frames).toBe(count);
      for (let n = 0; n < count; n += 1) {
        const p = join(V3_EFFECTS, `${family}-${String(n).padStart(2, '0')}.png`);
        expect(existsSync(p), `Missing effects frame ${family}-${n}`).toBe(true);
      }
      total += count;
    }
    expect(readdirSync(V3_EFFECTS).filter((f) => f.endsWith('.png'))).toHaveLength(total);
  });

  it('does not import Andrew-side assets into the asset tree or src tree', () => {
    // Compare paths relative to the asset root: an absolute path would otherwise
    // match the checkout directory rather than any asset name.
    const assetPaths = walk(ASSETS_ROOT).map((path) => relative(ASSETS_ROOT, path).toLowerCase());
    expect(assetPaths.length).toBeGreaterThan(0);
    expect(assetPaths.some((path) => path.includes('andrew'))).toBe(false);

    const srcDir = join(process.cwd(), 'src');
    const srcPaths = walk(srcDir).map((path) => relative(srcDir, path).toLowerCase());
    expect(srcPaths.some((path) => path.includes('andrew'))).toBe(false);
  });

  it('maintains byte-accurate manifest integrity in atlas/v3/manifest.json', () => {
    const manifestPath = join(ATLAS_V3, 'manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    expect(manifest.assetPackVersion).toBe('atlas-v3');
    expect(manifest.files).toBeDefined();

    const fileEntries = Object.entries(manifest.files) as [string, { bytes: number; sha256: string; size: number[] }][];
    expect(fileEntries.length).toBeGreaterThanOrEqual(130);

    for (const [relPath, meta] of fileEntries) {
      const fullPath = join(ATLAS_V3, relPath);
      expect(existsSync(fullPath), `File in manifest missing on disk: ${relPath}`).toBe(true);
      const diskBytes = readFileSync(fullPath);
      expect(diskBytes.length, `Byte size mismatch for ${relPath}`).toBe(meta.bytes);
    }
  });
});
