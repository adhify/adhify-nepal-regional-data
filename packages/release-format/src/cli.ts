// Usage: pnpm validate <release-dir> [--publication] [--public-key <base64>]... [--admin-units <dir>]
// Exits 0 when the release is valid, 1 with one line per issue otherwise.
import { basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { readReleaseDir } from './node.ts';
import { validateRelease } from './release.ts';
import type { AdminUnitsFile } from './types.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    publication: { type: 'boolean', default: false },
    'public-key': { type: 'string', multiple: true },
    'admin-units': { type: 'string' },
  },
});

const dir = positionals[0];
if (!dir) {
  console.error(
    'Usage: validate <release-dir> [--publication] [--public-key <base64>] [--admin-units <dir>]',
  );
  process.exit(2);
}

const input = await readReleaseDir(resolve(dir));
if (values['admin-units']) {
  const units = await readReleaseDir(resolve(values['admin-units']));
  const bytes = units.files.get('data/admin-units.json');
  if (bytes) input.adminUnits = JSON.parse(new TextDecoder().decode(bytes)) as AdminUnitsFile;
}
const publicKeys = values['public-key']?.map((key) =>
  Uint8Array.from(atob(key), (c) => c.charCodeAt(0)),
);

const result = await validateRelease(input, { forPublication: values.publication, publicKeys });
const name = result.manifest
  ? `${result.manifest.dataset}@${result.manifest.version}`
  : basename(dir);
if (result.manifest && basename(resolve(dir)) !== name) {
  result.issues.push({ code: 'directory_name', path: dir, message: `should be named ${name}` });
  result.ok = false;
}

if (result.ok) {
  console.log(`${name}: valid`);
} else {
  for (const issue of result.issues) console.log(`${issue.code}\t${issue.path}\t${issue.message}`);
  console.log(`${name}: ${result.issues.length} issue(s)`);
  process.exit(1);
}
