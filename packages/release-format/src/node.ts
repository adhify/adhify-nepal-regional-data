// Node helpers: read a release directory (manifest.json, optional manifest.sig, data/*).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReleaseInput } from './release.ts';

export async function readReleaseDir(dir: string): Promise<ReleaseInput> {
  const manifest = new Uint8Array(await readFile(join(dir, 'manifest.json')));
  const files = new Map<string, Uint8Array>();
  for (const name of await readdir(join(dir, 'data')).catch(() => [] as string[])) {
    files.set(`data/${name}`, new Uint8Array(await readFile(join(dir, 'data', name))));
  }
  const signature = await readFile(join(dir, 'manifest.sig'), 'utf8').catch(() => undefined);
  return { manifest, files, signature };
}
