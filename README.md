# adhify-nepal-regional-data

The release format for Adhify's regional datasets, with its validator. Later this repository will also hold the offline SDK.

This repository contains **no real data**. Every value under `fixtures/` is synthetic: far-future years, names that start with "Synthetic", and shapes near 0°, 0°. Real dataset releases are reviewed and approved by a person before they are published. They are distributed as release files, not kept here.

## Datasets

| Dataset             | File                                                                                                                                                                    | Coverage   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `calendar`          | `data/calendar.json`: one record per Bikram Sambat year, with the AD date of 1 Baisakh and the 12 month lengths                                                         | BS years   |
| `holidays`          | `data/holidays.json`: date, English and Nepali names, scope (national, province or group), status (`announced`, `changed` with `previous_date`, `cancelled`) and source | AD years   |
| `business-calendar` | `data/business-calendar.json`: per AD year, weekly rest days, closed dates and open dates                                                                               | AD years   |
| `admin-units`       | `data/admin-units.json`: province, district, municipality and ward, with parent and validity dates                                                                      | as-of date |
| `boundaries`        | `data/boundaries.geojson` and `data/boundaries-simplified.geojson` (GeoJSON, RFC 7946), one feature per unit version                                                    | as-of date |

## Releases

A release is one version of one dataset, stored in a directory named `<dataset>@<version>`:

```
holidays@2026.2/
  manifest.json   dataset, version, schema_version, coverage, files with SHA-256 and size, sources, review
  manifest.sig    Ed25519 signature of the exact manifest.json bytes (base64)
  data/holidays.json
```

- **Versions:** `<year>.<n>`, separately for each dataset.
- **Schema versions:** every file carries `schema_version`, and a breaking change is a new major version.
- **Schemas:** the JSON Schemas in [`packages/release-format/schemas/`](packages/release-format/schemas) define the format for every language.

## Validator

`@adhify/release-format` checks a whole release:

- the manifest and each data file against the JSON Schemas (Ajv);
- the exact file set, with sizes and SHA-256 checksums;
- rules a schema cannot express: consecutive BS years whose AD start dates follow on, year lengths, real calendar dates, coverage, duplicate IDs, holiday changes, closed and open dates, unit parents one level up, non-overlapping unit versions, closed polygon rings, and boundary units that exist in the admin-units release they depend on;
- optionally, the manifest signature against trusted public keys;
- before publication, that the release is approved, not synthetic, and that every source allows redistribution.

It uses only Web Crypto, so it runs in Node, browsers and Workers.

```sh
pnpm install
pnpm validate packages/release-format/fixtures/synthetic/holidays@2026.1
pnpm validate <dir> --publication --public-key <base64> [--admin-units <dir>]
```

## Development

| Purpose                       | Command                   |
| ----------------------------- | ------------------------- |
| Typecheck                     | `pnpm typecheck`          |
| Lint and formatting check     | `pnpm lint`               |
| Tests                         | `pnpm test`               |
| Regenerate synthetic fixtures | `pnpm fixtures:synthetic` |

Requires Node.js 24 and pnpm 11. CI also checks that the committed fixtures match the generator's output byte for byte.

## Licence

Code: [Apache-2.0](LICENSE). Each dataset release states its own data licence, for each source, in its manifest.
