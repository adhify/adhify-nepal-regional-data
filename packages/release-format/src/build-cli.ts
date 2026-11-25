// Builds a candidate release folder from a CSV you filled in (R1.3), then validates it:
//   pnpm release:build calendar --csv <file.csv> --version <year.n> --source <src-id>
//       --licence "<licence as recorded in the admin>" [--redistribution-allowed] --out <folder>
// Writes <folder>/calendar@<version>/ with data/calendar.json and manifest.json, ready to import in
// the admin. Problems are reported by CSV line. It never overwrites an existing folder.
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildCalendarRelease, calendarFromCsv, lineOfIssue } from './build.ts';
import { validateRelease } from './release.ts';

// pnpm runs scripts inside the package folder; resolve paths from where the command was typed.
const fromCaller = (path: string) => resolve(process.env.INIT_CWD ?? process.cwd(), path);

const USAGE =
  'Usage: release:build calendar --csv <file.csv> --version <year.n> --source <src-id> ' +
  '--licence "<text>" [--redistribution-allowed] --out <folder>';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    csv: { type: 'string' },
    version: { type: 'string' },
    source: { type: 'string' },
    licence: { type: 'string' },
    'redistribution-allowed': { type: 'boolean', default: false },
    out: { type: 'string' },
  },
});

const dataset = positionals[0];
if (dataset !== 'calendar') {
  fail(dataset ? `${dataset}: only "calendar" can be built so far.\n${USAGE}` : USAGE);
}
const csvPath = values.csv ?? fail(USAGE);
const version = values.version ?? fail(USAGE);
const sourceId = values.source ?? fail(USAGE);
const licence = values.licence ?? fail(USAGE);
const out = values.out ?? fail(USAGE);
if (!/^[0-9]{4}\.[1-9][0-9]*$/.test(version))
  fail(`--version must look like 2026.1, not ${version}.`);
if (!/^src-[a-z0-9-]{1,60}$/.test(sourceId)) fail(`--source must be a source ID like src-example.`);
if (sourceId.includes('synthetic')) fail('Synthetic sources are for tests only.');

const read = calendarFromCsv(
  await readFile(fromCaller(csvPath), 'utf8').catch(() => fail(`Cannot read ${csvPath}.`)),
);
if (!read.ok) {
  for (const error of read.errors) console.error(`line ${error.line}: ${error.message}`);
  fail(`${read.errors.length} problem(s) in ${csvPath}. Nothing was written.`);
}

const release = await buildCalendarRelease({
  version,
  records: read.records,
  source: { id: sourceId, licence, redistribution_allowed: values['redistribution-allowed'] },
  createdAt: new Date(),
});
const result = await validateRelease({ manifest: release.manifest, files: release.files });
if (!result.ok) {
  for (const issue of result.issues) {
    const line = lineOfIssue(issue.path, read.lines);
    console.error(`${line ? `line ${line}` : issue.path}: ${issue.message} (${issue.code})`);
  }
  fail(`${result.issues.length} problem(s). Nothing was written.`);
}

const folder = join(fromCaller(out), release.name);
if (await stat(folder).catch(() => null)) fail(`${folder} already exists. Choose another --out.`);
await mkdir(join(folder, 'data'), { recursive: true });
await writeFile(join(folder, 'manifest.json'), release.manifest);
for (const [path, bytes] of release.files) await writeFile(join(folder, path), bytes);
console.log(
  `Built ${release.name} (${read.records.length} years, BS ${read.records[0]!.bs_year}–${read.records.at(-1)!.bs_year}) in ${folder}`,
);
console.log(
  'Next: import it in the admin (Releases → Import release) or with pnpm release:import.',
);
