// Node helpers: read a release directory (manifest.json, optional manifest.sig, data/*).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function readReleaseDir(dir) {
    const manifest = new Uint8Array(await readFile(join(dir, 'manifest.json')));
    const files = new Map();
    for (const name of await readdir(join(dir, 'data')).catch(() => [])) {
        files.set(`data/${name}`, new Uint8Array(await readFile(join(dir, 'data', name))));
    }
    const signature = await readFile(join(dir, 'manifest.sig'), 'utf8').catch(() => undefined);
    return { manifest, files, signature };
}
