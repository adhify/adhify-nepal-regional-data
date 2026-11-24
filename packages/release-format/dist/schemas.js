import * as generated from './generated/validators.js';
const validators = {
    manifest: generated.manifest,
    calendar: generated.calendar,
    holidays: generated.holidays,
    'business-calendar': generated.businessCalendar,
    'admin-units': generated.adminUnits,
    boundaries: generated.boundaries,
};
function toIssues(file, errors) {
    return (errors ?? []).map((error) => ({
        code: 'schema',
        path: `${file}#${error.instancePath}`,
        message: `${error.message ?? 'is invalid'}${error.keyword === 'additionalProperties'
            ? ` (${String(error.params.additionalProperty)})`
            : ''}`,
    }));
}
/** Validates `value` against the manifest schema or a dataset's file schema. */
export function checkSchema(kind, file, value) {
    const validate = validators[kind];
    return validate(value) ? [] : toIssues(file, validate.errors);
}
