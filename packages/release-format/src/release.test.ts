// R1.1 done criterion: the validator accepts every valid synthetic fixture and rejects each
// malformed variant with the right issue code. Malformed variants are made by changing one thing
// in a valid fixture; checksums are recomputed unless the test is about checksums.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from './crypto.ts';
import { readReleaseDir } from './node.ts';
import { validateRelease, type ReleaseInput, type ReleaseOptions } from './release.ts';
import { DATASETS, type AdminUnitsFile, type Dataset, type Manifest } from './types.ts';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'synthetic');
const encode = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`);
const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes));

// Fixture values are loosely typed on purpose: tests write invalid shapes into them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

interface Fixture {
  manifest: Loose;
  files: Map<string, Loose>;
}

async function load(dataset: Dataset): Promise<Fixture> {
  const input = await readReleaseDir(join(FIXTURES, `${dataset}@2026.1`));
  return {
    manifest: decode(input.manifest),
    files: new Map([...input.files].map(([path, bytes]) => [path, decode(bytes)])),
  };
}

/** Serializes a fixture back to a release input, recomputing sizes and checksums. */
async function pack(fixture: Fixture, rehash = true): Promise<ReleaseInput> {
  const files = new Map<string, Uint8Array>();
  for (const [path, value] of fixture.files) {
    files.set(path, typeof value === 'string' ? new TextEncoder().encode(value) : encode(value));
  }
  if (rehash) {
    for (const entry of fixture.manifest.files ?? []) {
      const bytes = files.get(entry.path);
      if (!bytes) continue;
      entry.bytes = bytes.length;
      entry.sha256 = await sha256Hex(bytes);
    }
  }
  return { manifest: encode(fixture.manifest), files };
}

async function adminUnits(): Promise<AdminUnitsFile> {
  return (await load('admin-units')).files.get('data/admin-units.json');
}

async function codes(
  dataset: Dataset,
  change: (f: Fixture) => void | Promise<void>,
  options: ReleaseOptions & { rehash?: boolean; withAdminUnits?: boolean } = {},
): Promise<string[]> {
  const fixture = await load(dataset);
  await change(fixture);
  const input = await pack(fixture, options.rehash ?? true);
  if (options.withAdminUnits) input.adminUnits = await adminUnits();
  const result = await validateRelease(input, options);
  expect(result.ok).toBe(false);
  return result.issues.map((issue) => issue.code);
}

const data = (f: Fixture, path: string) => f.files.get(path);
const records = (f: Fixture, dataset: Exclude<Dataset, 'boundaries'>) =>
  data(f, `data/${dataset}.json`).records;

describe('valid synthetic fixtures', () => {
  it.each(DATASETS)('%s@2026.1 is valid as committed', async (dataset) => {
    const input = await readReleaseDir(join(FIXTURES, `${dataset}@2026.1`));
    if (dataset === 'boundaries') input.adminUnits = await adminUnits();
    const result = await validateRelease(input);
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
    expect((result.manifest as Manifest).synthetic).toBe(true);
  });
});

describe('manifest and file set', () => {
  it.each([
    ['an unknown manifest field', (f: Fixture) => void (f.manifest.extra = 1), 'schema'],
    [
      'a version without a sequence number',
      (f: Fixture) => void (f.manifest.version = '2026'),
      'schema',
    ],
    [
      'a schema major version other than 1',
      (f: Fixture) => void (f.manifest.schema_version = '2.0.0'),
      'schema',
    ],
    [
      'calendar coverage in AD years',
      (f: Fixture) => void (f.manifest.coverage = { ad_years: { from: 2900, to: 2900 } }),
      'schema',
    ],
    [
      'a file listed but absent',
      (f: Fixture) => void f.files.delete('data/calendar.json'),
      'missing_file',
    ],
    [
      'an unlisted file present',
      (f: Fixture) => void f.files.set('data/extra.json', {}),
      'unexpected_file',
    ],
    [
      'a file that is not JSON',
      (f: Fixture) => void f.files.set('data/calendar.json', '{not json'),
      'invalid_json',
    ],
    [
      'a data file whose version differs from the manifest',
      (f: Fixture) => void (data(f, 'data/calendar.json').version = '2026.9'),
      'manifest_mismatch',
    ],
    [
      'a file listed with the wrong media type',
      (f: Fixture) => void (f.manifest.files[0].media_type = 'application/geo+json'),
      'media_type',
    ],
  ])('rejects %s', async (_name, change, code) => {
    expect(await codes('calendar', change)).toContain(code);
  });

  it('rejects bytes that do not match the manifest checksum', async () => {
    // Same length, different content: only the checksum can catch it.
    const found = await codes(
      'calendar',
      (f) => void (records(f, 'calendar')[0].ad_start = '2844-04-14'),
      { rehash: false },
    );
    expect(found).toContain('checksum_mismatch');
    expect(found).not.toContain('size_mismatch');
  });

  it('rejects bytes whose size does not match the manifest', async () => {
    const input = await pack(await load('calendar'));
    const bytes = input.files.get('data/calendar.json') as Uint8Array;
    input.files = new Map([['data/calendar.json', new Uint8Array([...bytes, 0x20])]]);
    const found = (await validateRelease(input)).issues.map((i) => i.code);
    expect(found).toEqual(['size_mismatch', 'checksum_mismatch']);
  });

  it('rejects a boundaries release without depends_on', async () => {
    expect(await codes('boundaries', (f) => void delete f.manifest.depends_on)).toContain('schema');
  });
});

describe('calendar', () => {
  it.each([
    [
      'a month of 33 days',
      (f: Fixture) => void (records(f, 'calendar')[0].month_lengths[0] = 33),
      'schema',
    ],
    [
      'a year with 11 months',
      (f: Fixture) => void records(f, 'calendar')[0].month_lengths.pop(),
      'schema',
    ],
    ['a missing year', (f: Fixture) => void records(f, 'calendar').splice(1, 1), 'calendar_gap'],
    [
      'a start date one day off',
      (f: Fixture) => void (records(f, 'calendar')[1].ad_start = '2845-04-14'),
      'calendar_discontinuity',
    ],
    [
      'a year of 360 days',
      (f: Fixture) => void (records(f, 'calendar')[2].month_lengths = Array(12).fill(30)),
      'calendar_year_length',
    ],
    [
      'coverage that does not match the records',
      (f: Fixture) => void (f.manifest.coverage.bs_years.to = 2904),
      'coverage_mismatch',
    ],
    [
      'an impossible date',
      (f: Fixture) => void (records(f, 'calendar')[0].ad_start = '2844-02-30'),
      'invalid_date',
    ],
  ])('rejects %s', async (_name, change, code) => {
    expect(await codes('calendar', change)).toContain(code);
  });
});

describe('holidays', () => {
  const holiday = (f: Fixture, i: number) => records(f, 'holidays')[i];
  it.each([
    ['a duplicate ID', (f: Fixture) => void (holiday(f, 1).id = holiday(f, 0).id), 'duplicate_id'],
    [
      'a changed holiday without its previous date',
      (f: Fixture) => void delete holiday(f, 2).previous_date,
      'schema',
    ],
    [
      'an announced holiday with a previous date',
      (f: Fixture) => void (holiday(f, 0).previous_date = '2900-01-14'),
      'schema',
    ],
    [
      'a province holiday without a province',
      (f: Fixture) => void delete holiday(f, 1).scope.value,
      'schema',
    ],
    [
      'a national holiday with a scope value',
      (f: Fixture) => void (holiday(f, 0).scope.value = 'SP1'),
      'schema',
    ],
    ['a name without Nepali', (f: Fixture) => void delete holiday(f, 0).name.ne, 'schema'],
    [
      'a status outside announced/changed/cancelled',
      (f: Fixture) => void (holiday(f, 0).status = 'official'),
      'schema',
    ],
    [
      'a date outside coverage',
      (f: Fixture) => void (holiday(f, 0).date = '2901-01-15'),
      'out_of_coverage',
    ],
    [
      'a source missing from the manifest',
      (f: Fixture) => void (holiday(f, 0).source = 'src-unknown'),
      'unknown_source',
    ],
    [
      'a change that keeps the same date',
      (f: Fixture) => void (holiday(f, 2).previous_date = holiday(f, 2).date),
      'invalid_change',
    ],
  ])('rejects %s', async (_name, change, code) => {
    expect(await codes('holidays', change)).toContain(code);
  });
});

describe('business calendar', () => {
  const year = (f: Fixture) => records(f, 'business-calendar')[0];
  it.each([
    [
      'a covered year without a record',
      (f: Fixture) => void (f.manifest.coverage.ad_years.to = 2901),
      'coverage_mismatch',
    ],
    [
      'a duplicate year',
      (f: Fixture) => void records(f, 'business-calendar').push(structuredClone(year(f))),
      'duplicate_year',
    ],
    [
      'a closed date in another year',
      (f: Fixture) => void (year(f).closed_dates[1].date = '2901-03-02'),
      'date_outside_year',
    ],
    [
      'a date both closed and open',
      (f: Fixture) => void year(f).closed_dates.push({ date: year(f).open_dates[0] }),
      'conflicting_date',
    ],
    [
      'an open date that is not a rest day',
      (f: Fixture) => void (year(f).weekly_rest_days = [0]),
      'open_date_not_rest_day',
    ],
    [
      'a closed date listed twice',
      (f: Fixture) => void year(f).closed_dates.push({ date: '2900-03-02' }),
      'duplicate_date',
    ],
    ['a weekday number of 7', (f: Fixture) => void (year(f).weekly_rest_days = [7]), 'schema'],
  ])('rejects %s', async (_name, change, code) => {
    expect(await codes('business-calendar', change)).toContain(code);
  });
});

describe('administrative units', () => {
  const unit = (f: Fixture, code: string, from = '2890-01-01') =>
    records(f, 'admin-units').find((u: Loose) => u.code === code && u.valid_from === from);
  it.each([
    [
      'a province with a parent',
      (f: Fixture) => void (unit(f, 'SP1').parent_code = 'SP1-D1'),
      'invalid_parent',
    ],
    [
      'a district without a parent',
      (f: Fixture) => void (unit(f, 'SP1-D1').parent_code = null),
      'invalid_parent',
    ],
    [
      'a parent that does not exist',
      (f: Fixture) => void (unit(f, 'SP1-D1').parent_code = 'SP9'),
      'unknown_parent',
    ],
    [
      'a ward whose parent is a district',
      (f: Fixture) => void (unit(f, 'SP1-D1-M1-W1').parent_code = 'SP1-D1'),
      'invalid_parent',
    ],
    [
      'overlapping versions of one unit',
      (f: Fixture) => void (unit(f, 'SP1-D2').valid_to = '2896-06-30'),
      'overlapping_validity',
    ],
    [
      'a unit that ends before it starts',
      (f: Fixture) => void (unit(f, 'SP1-D2').valid_to = '2889-12-31'),
      'invalid_range',
    ],
    [
      'the same unit version twice',
      (f: Fixture) => void records(f, 'admin-units').push(structuredClone(unit(f, 'SP1'))),
      'duplicate_unit',
    ],
    [
      'a unit starting after the release date',
      (f: Fixture) => void (unit(f, 'SP1-D2', '2896-01-01').valid_from = '2901-01-01'),
      'out_of_coverage',
    ],
    ['an unknown level', (f: Fixture) => void (unit(f, 'SP1-D1').level = 'zone'), 'schema'],
  ])('rejects %s', async (_name, change, code) => {
    expect(await codes('admin-units', change)).toContain(code);
  });
});

describe('boundaries', () => {
  const full = (f: Fixture) => data(f, 'data/boundaries.geojson').features;
  const ring = (f: Fixture) => full(f)[0].geometry.coordinates[0];
  it.each([
    [
      'a ring that is not closed',
      (f: Fixture) => void (ring(f)[4] = [0.5, 0.5]),
      'ring_not_closed',
    ],
    ['a ring of three positions', (f: Fixture) => void ring(f).splice(1, 2), 'schema'],
    ['a longitude beyond 180', (f: Fixture) => void (ring(f)[1] = [200, 0]), 'schema'],
    [
      'a feature listed twice',
      (f: Fixture) => void full(f).push(structuredClone(full(f)[0])),
      'duplicate_unit',
    ],
    [
      'a simplified file missing a unit',
      (f: Fixture) => void data(f, 'data/boundaries-simplified.geojson').features.pop(),
      'simplified_mismatch',
    ],
    [
      'a unit version not in admin-units',
      (f: Fixture) => void (full(f)[2].properties.valid_from = '2893-01-01'),
      'unknown_unit',
    ],
    [
      'a dependency on a different admin-units release',
      (f: Fixture) => void (f.manifest.depends_on = ['admin-units@2026.2']),
      'dependency_mismatch',
    ],
  ])('rejects %s', async (_name, change, code) => {
    expect(await codes('boundaries', change, { withAdminUnits: true })).toContain(code);
  });
});

describe('publication gate (R1.3, R1.5)', () => {
  const publish = { forPublication: true };
  it('never publishes a synthetic release', async () => {
    expect(await codes('holidays', () => {}, publish)).toEqual(['synthetic_release']);
  });

  it.each([
    [
      'a rejected release',
      (f: Fixture) => void (f.manifest.review.decision = 'rejected'),
      'not_approved',
    ],
    ['a release not yet reviewed', (f: Fixture) => void delete f.manifest.review, 'not_approved'],
    [
      'a source that forbids redistribution',
      (f: Fixture) => void (f.manifest.sources[0].redistribution_allowed = false),
      'redistribution_not_allowed',
    ],
  ])('blocks %s', async (_name, change, code) => {
    const found = await codes(
      'holidays',
      (f) => {
        f.manifest.synthetic = false;
        change(f);
      },
      publish,
    );
    expect(found).toEqual([code]);
  });
});

describe('manifest signature (Ed25519)', () => {
  async function keyPair() {
    const keys = (await crypto.subtle.generateKey('Ed25519', true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
    return { keys, raw };
  }
  async function sign(privateKey: CryptoKey, bytes: Uint8Array) {
    const signature = new Uint8Array(
      await crypto.subtle.sign('Ed25519', privateKey, bytes as BufferSource),
    );
    return btoa(String.fromCharCode(...signature));
  }

  it('accepts a manifest signed by a trusted key, including one of several', async () => {
    const { keys, raw } = await keyPair();
    const old = await keyPair();
    const input = await pack(await load('calendar'));
    input.signature = await sign(keys.privateKey, input.manifest);
    const result = await validateRelease(input, { publicKeys: [old.raw, raw] });
    expect(result.issues).toEqual([]);
  });

  it.each([
    ['an untrusted key', true, false, false],
    ['a manifest changed after signing', false, true, false],
    ['a missing signature', false, false, true],
  ])('rejects %s', async (_name, otherKey, tamper, omit) => {
    const { keys, raw } = await keyPair();
    const other = await keyPair();
    const fixture = await load('calendar');
    const input = await pack(fixture);
    input.signature = omit ? undefined : await sign(keys.privateKey, input.manifest);
    if (tamper)
      input.manifest = encode({ ...fixture.manifest, created_at: '2026-11-21T00:00:00Z' });
    const result = await validateRelease(input, { publicKeys: [otherKey ? other.raw : raw] });
    expect(result.issues.map((i) => i.code)).toEqual(['invalid_signature']);
  });
});
