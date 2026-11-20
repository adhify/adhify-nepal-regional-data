// Writes fixtures/synthetic/<dataset>@<version>/ for every dataset: obviously synthetic values
// (far-future years, "Synthetic" names, squares near 0°, 0°) and manifests with real checksums.
// No real data (C-08). CI checks that the committed fixtures match this script's output.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256Hex } from '../src/crypto.ts';
import type { Dataset, Manifest, ManifestFile, Position } from '../src/types.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'synthetic');
const VERSION = '2026.1';
const SCHEMA_VERSION = '1.0.0';
const CREATED_AT = '2026-11-20T00:00:00Z';
const SOURCES = [
  { id: 'src-synthetic', licence: 'Synthetic test data', redistribution_allowed: true },
];
const REVIEW = {
  reviewer: 'synthetic-reviewer',
  decision: 'approved' as const,
  decided_at: '2026-11-20T00:00:00Z',
};

const envelope = (dataset: Dataset) => ({
  dataset,
  version: VERSION,
  schema_version: SCHEMA_VERSION,
});

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function square(x: number, y: number, size: number): Position[][] {
  return [
    [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ],
  ];
}

// Calendar: synthetic BS years 2901–2903, lengths of 365 and 366 days.
const MONTHS: number[][] = [
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  [31, 31, 32, 32, 31, 30, 30, 30, 29, 29, 30, 31],
  [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
];
let start = '2844-04-13';
const calendar = {
  ...envelope('calendar'),
  records: MONTHS.map((month_lengths, i) => {
    const record = { bs_year: 2901 + i, ad_start: start, month_lengths };
    start = addDays(
      start,
      month_lengths.reduce((a, b) => a + b, 0),
    );
    return record;
  }),
};

const holidays = {
  ...envelope('holidays'),
  records: [
    {
      id: 'hol-synthetic-a',
      date: '2900-01-15',
      name: { en: 'Synthetic holiday A', ne: 'कृत्रिम बिदा क' },
      scope: { kind: 'national' },
      status: 'announced',
      source: 'src-synthetic',
    },
    {
      id: 'hol-synthetic-b',
      date: '2900-03-02',
      name: { en: 'Synthetic holiday B', ne: 'कृत्रिम बिदा ख' },
      scope: { kind: 'province', value: 'SP1' },
      status: 'announced',
      source: 'src-synthetic',
    },
    {
      id: 'hol-synthetic-c',
      date: '2900-05-20',
      name: { en: 'Synthetic holiday C', ne: 'कृत्रिम बिदा ग' },
      scope: { kind: 'group', value: 'synthetic-group' },
      status: 'changed',
      previous_date: '2900-05-19',
      source: 'src-synthetic',
    },
    {
      id: 'hol-synthetic-d',
      date: '2900-08-08',
      name: { en: 'Synthetic holiday D', ne: 'कृत्रिम बिदा घ' },
      scope: { kind: 'national' },
      status: 'cancelled',
      source: 'src-synthetic',
    },
  ],
};

// First Saturday of March 2900, open as a synthetic make-up working day.
let saturday = '2900-03-01';
while (new Date(`${saturday}T00:00:00Z`).getUTCDay() !== 6) saturday = addDays(saturday, 1);
const businessCalendar = {
  ...envelope('business-calendar'),
  records: [
    {
      year: 2900,
      weekly_rest_days: [6],
      closed_dates: [{ date: '2900-01-15', holiday_id: 'hol-synthetic-a' }, { date: '2900-03-02' }],
      open_dates: [saturday],
    },
  ],
};

const name = (en: string, ne: string) => ({ en, ne });
const adminUnits = {
  ...envelope('admin-units'),
  records: [
    {
      code: 'SP1',
      level: 'province',
      name: name('Synthetic Province 1', 'कृत्रिम प्रदेश १'),
      parent_code: null,
      valid_from: '2890-01-01',
      valid_to: null,
    },
    {
      code: 'SP1-D1',
      level: 'district',
      name: name('Synthetic District 1', 'कृत्रिम जिल्ला १'),
      parent_code: 'SP1',
      valid_from: '2890-01-01',
      valid_to: null,
    },
    {
      code: 'SP1-D2',
      level: 'district',
      name: name('Synthetic District 2 (old)', 'कृत्रिम जिल्ला २ (पुरानो)'),
      parent_code: 'SP1',
      valid_from: '2890-01-01',
      valid_to: '2895-12-31',
    },
    {
      code: 'SP1-D2',
      level: 'district',
      name: name('Synthetic District 2', 'कृत्रिम जिल्ला २'),
      parent_code: 'SP1',
      valid_from: '2896-01-01',
      valid_to: null,
    },
    {
      code: 'SP1-D1-M1',
      level: 'municipality',
      name: name('Synthetic Municipality 1', 'कृत्रिम नगरपालिका १'),
      parent_code: 'SP1-D1',
      valid_from: '2890-01-01',
      valid_to: null,
    },
    {
      code: 'SP1-D1-M1-W1',
      level: 'ward',
      name: name('Synthetic Ward 1', 'कृत्रिम वडा १'),
      parent_code: 'SP1-D1-M1',
      valid_from: '2890-01-01',
      valid_to: null,
    },
  ],
};

const boundaryFeatures = (size: number) =>
  [
    { unit: 'SP1', from: '2890-01-01', x: 0, y: 0, s: 2 * size },
    { unit: 'SP1-D1', from: '2890-01-01', x: 0, y: 0, s: size },
    { unit: 'SP1-D2', from: '2896-01-01', x: size, y: 0, s: size },
  ].map((f) => ({
    type: 'Feature',
    properties: { unit_code: f.unit, valid_from: f.from },
    geometry: { type: 'Polygon', coordinates: square(f.x, f.y, f.s) },
  }));
const boundaries = (size: number) => ({
  type: 'FeatureCollection',
  ...envelope('boundaries'),
  features: boundaryFeatures(size),
});

const json = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);

async function writeRelease(
  dataset: Dataset,
  coverage: Manifest['coverage'],
  files: { path: string; media_type: ManifestFile['media_type']; value: unknown }[],
  extra: Partial<Manifest> = {},
) {
  const dir = join(ROOT, `${dataset}@${VERSION}`);
  await mkdir(join(dir, 'data'), { recursive: true });
  const listed: ManifestFile[] = [];
  for (const file of files) {
    const bytes = json(file.value);
    await writeFile(join(dir, file.path), bytes);
    listed.push({
      path: file.path,
      sha256: await sha256Hex(bytes),
      bytes: bytes.length,
      media_type: file.media_type,
    });
  }
  const manifest: Manifest = {
    dataset,
    version: VERSION,
    schema_version: SCHEMA_VERSION,
    created_at: CREATED_AT,
    synthetic: true,
    coverage,
    ...extra,
    files: listed,
    sources: SOURCES,
    review: REVIEW,
  };
  await writeFile(join(dir, 'manifest.json'), json(manifest));
}

await rm(ROOT, { recursive: true, force: true });
await writeRelease('calendar', { bs_years: { from: 2901, to: 2903 } }, [
  { path: 'data/calendar.json', media_type: 'application/json', value: calendar },
]);
await writeRelease('holidays', { ad_years: { from: 2900, to: 2900 } }, [
  { path: 'data/holidays.json', media_type: 'application/json', value: holidays },
]);
await writeRelease('business-calendar', { ad_years: { from: 2900, to: 2900 } }, [
  { path: 'data/business-calendar.json', media_type: 'application/json', value: businessCalendar },
]);
await writeRelease('admin-units', { as_of: '2900-06-01' }, [
  { path: 'data/admin-units.json', media_type: 'application/json', value: adminUnits },
]);
await writeRelease(
  'boundaries',
  { as_of: '2900-06-01' },
  [
    { path: 'data/boundaries.geojson', media_type: 'application/geo+json', value: boundaries(1) },
    {
      path: 'data/boundaries-simplified.geojson',
      media_type: 'application/geo+json',
      value: boundaries(1),
    },
  ],
  { depends_on: [`admin-units@${VERSION}`] },
);
console.log(`Wrote synthetic fixtures to ${ROOT}`);
