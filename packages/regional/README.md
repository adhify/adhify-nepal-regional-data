# @adhify/regional

Offline Nepal regional data for JavaScript and TypeScript: BS↔AD dates, holidays, business days and administrative units.

- Works without a network connection and without an API key.
- Each SDK version bundles specific dataset releases, each reviewed by a person. `release()` tells you which.
- Data is never presented as official. Holidays keep the status their source gives them.

> Status: not published. Until the first approved release ships (milestone R1.5), this package bundles **synthetic** test data only, and `release().synthetic` is `true`.

## Install and import

Import a subpath to include only the data you use:

```ts
import { calendar } from '@adhify/regional/calendar';
import { holidays } from '@adhify/regional/holidays';
import { businessDays } from '@adhify/regional/business-days';
import { adminUnits } from '@adhify/regional/admin-units';
```

`@adhify/regional` re-exports all four modules, plus `releases()`, which lists the bundled releases.

AD dates are `YYYY-MM-DD` strings. BS dates are `{ year, month, day }` objects, with months numbered 1 (Baisakh) to 12 (Chaitra). The SDK uses no `Date` objects, so a time zone can never shift a day.

## Calendar

```ts
calendar.toBs('2026-04-14'); // { year, month, day }
calendar.toAd({ year: 2083, month: 1, day: 1 }); // 'YYYY-MM-DD'
calendar.daysInMonth(2083, 1); // 29–32
calendar.isValidBs({ year: 2083, month: 2, day: 32 }); // false if that day does not exist
calendar.range(); // { bs: { from, to }, ad: { from, to } }
calendar.release(); // { dataset: 'calendar', version, schema_version, synthetic }
formatBs({ year: 2083, month: 1, day: 5 }); // '2083-01-05'
parseBs('2083-01-05');
```

## Holidays

```ts
holidays.on('2026-10-20'); // every scope, cancelled ones excluded
holidays.on('2026-10-20', { scope: { province: 'P3' } }); // national plus that province
holidays.between('2026-01-01', '2026-12-31', { scope: { groups: ['...'] } });
holidays.isHoliday('2026-10-20', { scope: {} }); // national only
holidays.get('hol-…');
```

Each holiday includes `date`, `name.en`, `name.ne`, `scope` (`national`, `province` or `group`), `status` (`announced`, `changed` or `cancelled`), `previous_date` when changed, and `source`. Pass `includeCancelled: true` to see cancellations.

## Business days

```ts
businessDays.isBusinessDay('2026-10-20');
businessDays.next('2026-10-20');
businessDays.previous('2026-10-20');
businessDays.add('2026-10-20', 5); // negative numbers move back
businessDays.between('2026-10-01', '2026-11-01'); // from inclusive, to exclusive
```

A day is a business day unless it is a weekly rest day or a closed date. A listed open date counts as a business day even when it falls on a rest day.

## Administrative units

```ts
adminUnits.get('CODE'); // as of the release date
adminUnits.get('CODE', { asOf: '2015-01-01' }); // as it was then
adminUnits.find('CODE'); // undefined instead of an error
adminUnits.history('CODE'); // every version: renames, merges, splits
adminUnits.children('CODE');
adminUnits.ancestors('CODE'); // up to the province
adminUnits.list({ level: 'district' });
adminUnits.search('name', { level: 'municipality', limit: 10 }); // English or Nepali
```

## Errors

Every error extends `RegionalError` and has a stable `code`:

| Error                     | `code`                | When                                                                         |
| ------------------------- | --------------------- | ---------------------------------------------------------------------------- |
| `InvalidDateError`        | `invalid_date`        | Not a real date, or not in the form `YYYY-MM-DD`                             |
| `OutOfRangeError`         | `out_of_range`        | Outside the release's range; `error.range` gives the covered `from` and `to` |
| `UnknownUnitError`        | `unknown_unit`        | No unit with that code, or none on that date                                 |
| `UnsupportedReleaseError` | `unsupported_release` | A loaded release is for another dataset or schema version                    |

## Pinning another release

The bundled release is pinned by the SDK version you install. To use a release file you downloaded instead, first validate it (checksums and signature) with `@adhify/release-format`, then load it:

```ts
import { loadHolidays } from '@adhify/regional/holidays';
const pinned = loadHolidays(manifestJson, holidaysJson);
```

`loadCalendar`, `loadBusinessDays` and `loadAdminUnits` work the same way. `createCalendar` and its equivalents take an already assembled release object.

## Size

Each subpath's code is about 2–3 KB gzipped, and the root import about 5 KB. CI fails if any entry point's code exceeds 6 KB (`pnpm size`). Data is counted separately; its size depends on the release.

## Development

- `pnpm test` bundles the synthetic fixtures and runs the tests. These include seeded property tests of BS↔AD round trips, and a test that fails if any network API is reachable.
- `pnpm build` compiles to `dist/`.
- `node scripts/bundle.ts <release-dir>…` bundles real, approved releases. It refuses synthetic, unapproved or non-redistributable ones unless given `--synthetic`.
