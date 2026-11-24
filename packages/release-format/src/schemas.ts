// Structural validation against the published JSON Schemas (ADR 0002), with validators that
// scripts/build-validators.ts precompiled from those schemas (Ajv standalone). No code is compiled at
// runtime, so this also runs on Cloudflare Workers, where `new Function` is forbidden.
import type { ErrorObject } from 'ajv';
import * as generated from './generated/validators.js';
import type { Dataset, Issue } from './types.ts';

const validators: Record<Dataset | 'manifest', generated.StandaloneValidator> = {
  manifest: generated.manifest,
  calendar: generated.calendar,
  holidays: generated.holidays,
  'business-calendar': generated.businessCalendar,
  'admin-units': generated.adminUnits,
  boundaries: generated.boundaries,
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
