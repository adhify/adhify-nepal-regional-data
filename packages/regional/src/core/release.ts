// Turns a release's manifest and data file into the object the SDK reads (release pinning).
import { UnsupportedReleaseError } from '../errors.ts';
import type { Release, ReleaseInfo } from '../types.ts';

interface ManifestLike {
  dataset: string;
  version: string;
  schema_version: string;
  synthetic?: boolean;
  coverage: Release<unknown>['coverage'] & { bs_years?: unknown };
}

interface DataLike {
  dataset: string;
  version: string;
  schema_version: string;
}

/**
 * Pins a release you downloaded: pass its parsed `manifest.json` and data file. Validate the
 * release first (checksums and signature) with `@adhify/release-format`; this only checks that the
 * two belong together and that this SDK understands the schema.
 */
export function releaseFrom<D extends DataLike>(
  manifest: ManifestLike,
  data: D,
  expected: ReleaseInfo['dataset'],
): Release<D> {
  if (manifest.dataset !== expected || data.dataset !== expected) {
    throw new UnsupportedReleaseError(`expected a ${expected} release, got ${manifest.dataset}`);
  }
  if (manifest.version !== data.version || manifest.schema_version !== data.schema_version) {
    throw new UnsupportedReleaseError('the data file does not belong to this manifest');
  }
  if (!/^1\./.test(manifest.schema_version)) {
    throw new UnsupportedReleaseError(
      `schema ${manifest.schema_version} is not supported by this SDK (supports 1.x)`,
    );
  }
  return {
    info: {
      dataset: expected,
      version: manifest.version,
      schema_version: manifest.schema_version,
      synthetic: manifest.synthetic === true,
    },
    coverage: { ad_years: manifest.coverage.ad_years, as_of: manifest.coverage.as_of },
    data,
  };
}
