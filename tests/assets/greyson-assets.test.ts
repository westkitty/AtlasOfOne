import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'public', 'assets', 'greyson');
const MAP = join(ROOT, 'map');
const SPRITES = ['idle-front.png', 'idle-qfront.png', 'idle-left.png', 'idle-back.png', 'idle-qback.png'];

function pngDimensions(path: string) {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function walk(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const next = join(path, entry.name);
    return entry.isDirectory() ? walk(next) : [next];
  });
}

describe('canonical Greyson/Aerron runtime assets', () => {
  it('ships the five exact-size game-ready sprite slots', () => {
    expect(readdirSync(MAP).sort()).toEqual([...SPRITES].sort());
    for (const sprite of SPRITES) expect(pngDimensions(join(MAP, sprite))).toEqual({ width: 48, height: 64 });
  });

  it('does not import Andrew-side assets into the Greyson tree', () => {
    const paths = walk(ROOT).map((path) => path.toLowerCase());
    expect(paths.some((path) => path.includes('andrew'))).toBe(false);
  });
});
