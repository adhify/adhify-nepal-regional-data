// Test helpers: a seeded random generator (reproducible property tests, no dependency) and the
// synthetic fixture releases from @adhify/release-format.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** mulberry32: small, fast, deterministic. Not for security. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  'release-format',
  'fixtures',
  'synthetic',
);

/** Parsed manifest.json and data file of a synthetic fixture release. */
export async function syntheticRelease(dataset: string, file = dataset) {
  const dir = join(FIXTURES, `${dataset}@2026.1`);
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  const data = JSON.parse(await readFile(join(dir, 'data', `${file}.json`), 'utf8'));
  return { manifest, data };
}
