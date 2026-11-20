// Validates a whole release: manifest, file set, checksums, every data file, cross-file rules and,
// for publication, the gate from R1.3 (approved, not synthetic, redistribution allowed).
import {
  checkAdminUnits,
  checkBoundaries,
  checkBusinessCalendar,
  checkCalendar,
  checkHolidays,
} from './checks.ts';
import { sha256Hex, verifyManifestSignature } from './crypto.ts';
import { checkSchema } from './schemas.ts';
import {
  EXPECTED_FILES,
  type AdminUnitsFile,
  type BoundariesFile,
  type DataFile,
  type Dataset,
  type Issue,
  type Manifest,
  type Result,
} from './types.ts';

export interface ReleaseInput {
  /** Exact bytes of manifest.json (the signature covers these bytes). */
  manifest: Uint8Array;
  /** Data files by their manifest path, e.g. `data/calendar.json`. */
  files: ReadonlyMap<string, Uint8Array>;
  /** Contents of manifest.sig, if the release is signed. */
  signature?: string;
  /** The admin-units file a boundaries release depends on, to check unit references. */
  adminUnits?: AdminUnitsFile;
}

export interface ReleaseOptions {
  /** Publication gate: approved review, not synthetic, every source allows redistribution. */
  forPublication?: boolean;
  /** Trusted raw Ed25519 public keys; when given, a signature is required and verified. */
  publicKeys?: readonly Uint8Array[];
}

const decoder = new TextDecoder('utf-8', { fatal: true });

function parseJson(path: string, bytes: Uint8Array, issues: Issue[]): unknown {
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch {
    issues.push({ code: 'invalid_json', path, message: 'is not valid UTF-8 JSON' });
    return undefined;
  }
}

/** Schema plus semantic checks for one data file of a known dataset. */
export function validateDataFile(
  dataset: Dataset,
  path: string,
  value: unknown,
  manifest: Manifest,
  adminUnits?: AdminUnitsFile,
): Issue[] {
  const schemaIssues = checkSchema(dataset, path, value);
  if (schemaIssues.length > 0) return schemaIssues;
  const data = value as DataFile;
  const issues: Issue[] = [];
  for (const field of ['dataset', 'version', 'schema_version'] as const) {
    if (data[field] !== manifest[field]) {
      issues.push({
        code: 'manifest_mismatch',
        path: `${path}#/${field}`,
        message: `${String(data[field])} does not match the manifest's ${manifest[field]}`,
      });
    }
  }
  switch (data.dataset) {
    case 'calendar':
      return [...issues, ...checkCalendar(path, data, manifest)];
    case 'holidays':
      return [...issues, ...checkHolidays(path, data, manifest)];
    case 'business-calendar':
      return [...issues, ...checkBusinessCalendar(path, data, manifest)];
    case 'admin-units':
      return [...issues, ...checkAdminUnits(path, data, manifest)];
    case 'boundaries':
      return [...issues, ...checkBoundaries(path, data, adminUnits)];
  }
}

export async function validateRelease(
  input: ReleaseInput,
  options: ReleaseOptions = {},
): Promise<Result & { manifest?: Manifest }> {
  const issues: Issue[] = [];
  const done = (manifest?: Manifest) => ({ ok: issues.length === 0, issues, manifest });

  const parsed = parseJson('manifest.json', input.manifest, issues);
  if (parsed === undefined) return done();
  issues.push(...checkSchema('manifest', 'manifest.json', parsed));
  if (issues.length > 0) return done();
  const manifest = parsed as Manifest;

  // File set: exactly the files this dataset defines, each listed once with the right type.
  const expected = EXPECTED_FILES[manifest.dataset];
  const listed = new Map(manifest.files.map((file) => [file.path, file]));
  for (const file of expected) {
    const entry = listed.get(file.path);
    if (!entry) {
      issues.push({
        code: 'missing_file',
        path: 'manifest.json#/files',
        message: `${file.path} is not listed`,
      });
    } else if (entry.media_type !== file.media_type) {
      issues.push({ code: 'media_type', path: file.path, message: `should be ${file.media_type}` });
    }
  }
  if (listed.size !== manifest.files.length) {
    issues.push({
      code: 'duplicate_file',
      path: 'manifest.json#/files',
      message: 'a path is listed twice',
    });
  }
  for (const path of listed.keys()) {
    if (!expected.some((file) => file.path === path)) {
      issues.push({
        code: 'unexpected_file',
        path,
        message: `${manifest.dataset} releases do not contain this file`,
      });
    }
  }
  for (const path of input.files.keys()) {
    if (!listed.has(path)) {
      issues.push({
        code: 'unexpected_file',
        path,
        message: 'is present but not listed in the manifest',
      });
    }
  }

  // Bytes and checksums, then each file's content.
  const contents = new Map<string, unknown>();
  for (const file of manifest.files) {
    const bytes = input.files.get(file.path);
    if (!bytes) {
      issues.push({ code: 'missing_file', path: file.path, message: 'is listed but not present' });
      continue;
    }
    if (bytes.length !== file.bytes) {
      issues.push({
        code: 'size_mismatch',
        path: file.path,
        message: `is ${bytes.length} bytes, manifest says ${file.bytes}`,
      });
    }
    if ((await sha256Hex(bytes)) !== file.sha256) {
      issues.push({
        code: 'checksum_mismatch',
        path: file.path,
        message: 'SHA-256 does not match the manifest',
      });
    }
    const value = parseJson(file.path, bytes, issues);
    if (value === undefined) continue;
    contents.set(file.path, value);
    issues.push(
      ...validateDataFile(manifest.dataset, file.path, value, manifest, input.adminUnits),
    );
  }

  if (manifest.dataset === 'boundaries') {
    checkBoundaryRelease(manifest, contents, input.adminUnits, issues);
  }

  if (options.publicKeys) {
    const valid =
      input.signature !== undefined &&
      (await verifyManifestSignature(input.manifest, input.signature, options.publicKeys));
    if (!valid) {
      issues.push({
        code: 'invalid_signature',
        path: 'manifest.sig',
        message: 'missing, or not signed by a trusted key',
      });
    }
  }

  if (options.forPublication) {
    if (manifest.synthetic) {
      issues.push({
        code: 'synthetic_release',
        path: 'manifest.json#/synthetic',
        message: 'synthetic releases are never published',
      });
    }
    if (manifest.review?.decision !== 'approved') {
      issues.push({
        code: 'not_approved',
        path: 'manifest.json#/review',
        message: 'the founder has not approved this release',
      });
    }
    manifest.sources.forEach((source, i) => {
      if (!source.redistribution_allowed) {
        issues.push({
          code: 'redistribution_not_allowed',
          path: `manifest.json#/sources/${i}`,
          message: `${source.id} does not allow redistribution`,
        });
      }
    });
  }

  return done(manifest);
}

function unitKeys(file: unknown): Set<string> {
  const features = (file as BoundariesFile | undefined)?.features ?? [];
  return new Set(features.map((f) => `${f.properties?.unit_code}@${f.properties?.valid_from}`));
}

/** Full and simplified files describe the same units; the dependency matches depends_on. */
function checkBoundaryRelease(
  manifest: Manifest,
  contents: Map<string, unknown>,
  adminUnits: AdminUnitsFile | undefined,
  issues: Issue[],
): void {
  const full = unitKeys(contents.get('data/boundaries.geojson'));
  const simplified = unitKeys(contents.get('data/boundaries-simplified.geojson'));
  if (full.size !== simplified.size || [...full].some((key) => !simplified.has(key))) {
    issues.push({
      code: 'simplified_mismatch',
      path: 'data/boundaries-simplified.geojson',
      message: 'does not contain the same units as data/boundaries.geojson',
    });
  }
  const dependency = manifest.depends_on?.find((d) => d.startsWith('admin-units@'));
  if (!dependency) {
    issues.push({
      code: 'dependency_mismatch',
      path: 'manifest.json#/depends_on',
      message: 'boundaries must depend on an admin-units release',
    });
  } else if (adminUnits && dependency !== `admin-units@${adminUnits.version}`) {
    issues.push({
      code: 'dependency_mismatch',
      path: 'manifest.json#/depends_on',
      message: `depends on ${dependency}, checked against admin-units@${adminUnits.version}`,
    });
  }
}
