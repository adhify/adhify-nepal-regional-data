// TypeScript shapes of schemas/*.schema.json (schema_version 1). The JSON Schemas are the source of
// truth; these types describe data that has already passed them.
export const DATASETS = [
    'calendar',
    'holidays',
    'business-calendar',
    'admin-units',
    'boundaries',
];
export const ADMIN_LEVELS = ['province', 'district', 'municipality', 'ward'];
/** The data files every release of a dataset must contain, and nothing else. */
export const EXPECTED_FILES = {
    calendar: [{ path: 'data/calendar.json', media_type: 'application/json' }],
    holidays: [{ path: 'data/holidays.json', media_type: 'application/json' }],
    'business-calendar': [{ path: 'data/business-calendar.json', media_type: 'application/json' }],
    'admin-units': [{ path: 'data/admin-units.json', media_type: 'application/json' }],
    boundaries: [
        { path: 'data/boundaries.geojson', media_type: 'application/geo+json' },
        { path: 'data/boundaries-simplified.geojson', media_type: 'application/geo+json' },
    ],
};
