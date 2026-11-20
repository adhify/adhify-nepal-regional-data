// Structural validation with Ajv against the published JSON Schemas (ADR 0002).
import Ajv2020, { type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import adminUnits from '../schemas/admin-units.schema.json' with { type: 'json' };
import boundaries from '../schemas/boundaries.schema.json' with { type: 'json' };
import businessCalendar from '../schemas/business-calendar.schema.json' with { type: 'json' };
import calendar from '../schemas/calendar.schema.json' with { type: 'json' };
import common from '../schemas/common.schema.json' with { type: 'json' };
import manifest from '../schemas/manifest.schema.json' with { type: 'json' };
import holidays from '../schemas/holidays.schema.json' with { type: 'json' };
import type { Dataset, Issue } from './types.ts';

// Default strict mode: unknown keywords and invalid schemas fail at startup.
const ajv = new Ajv2020({ allErrors: true, allowUnionTypes: true });
ajv.addSchema(common);

const validators: Record<Dataset | 'manifest', ValidateFunction> = {
  manifest: ajv.compile(manifest),
  calendar: ajv.compile(calendar),
  holidays: ajv.compile(holidays),
  'business-calendar': ajv.compile(businessCalendar),
  'admin-units': ajv.compile(adminUnits),
  boundaries: ajv.compile(boundaries),
};

function toIssues(file: string, errors: ErrorObject[] | null | undefined): Issue[] {
  return (errors ?? []).map((error) => ({
    code: 'schema',
    path: `${file}#${error.instancePath}`,
    message: `${error.message ?? 'is invalid'}${
      error.keyword === 'additionalProperties'
        ? ` (${String((error.params as { additionalProperty?: string }).additionalProperty)})`
        : ''
    }`,
  }));
}

/** Validates `value` against the manifest schema or a dataset's file schema. */
export function checkSchema(kind: Dataset | 'manifest', file: string, value: unknown): Issue[] {
  const validate = validators[kind];
  return validate(value) ? [] : toIssues(file, validate.errors);
}
