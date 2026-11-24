// Size budget (R1.4): gzip size of each entry point's code, following its relative imports, with
// bundled data counted separately. Fails when code exceeds CODE_BUDGET. Run after `pnpm build`.
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const CODE_BUDGET = 6 * 1024; // bytes gzip per entry point, excluding data
const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const ENTRIES = ['calendar', 'holidays', 'business-days', 'admin-units', 'index'];

async function graph(file: string, seen = new Set<string>()): Promise<Set<string>> {
  if (seen.has(file)) return seen;
  seen.add(file);
  const text = await readFile(file, 'utf8');
  for (const match of text.matchAll(/from ['"](\.[^'"]+)['"]/g)) {
    await graph(normalize(join(dirname(file), match[1] as string)), seen);
  }
  return seen;
}

let failed = false;
for (const entry of ENTRIES) {
  let code = '';
  let data = '';
  for (const file of await graph(join(DIST, `${entry}.js`))) {
    const text = await readFile(file, 'utf8');
    if (file.includes(`${'/'}bundle${'/'}`)) data += text;
    else code += text;
  }
  const codeSize = gzipSync(code).length;
  const dataSize = gzipSync(data).length;
  const over = codeSize > CODE_BUDGET;
  failed ||= over;
  console.log(
    `${entry.padEnd(14)} code ${(codeSize / 1024).toFixed(1)} KB gzip${over ? ' OVER BUDGET' : ''}, data ${(dataSize / 1024).toFixed(1)} KB gzip`,
  );
}
console.log(`Budget: ${CODE_BUDGET / 1024} KB gzip of code per entry point.`);
if (failed) process.exit(1);
