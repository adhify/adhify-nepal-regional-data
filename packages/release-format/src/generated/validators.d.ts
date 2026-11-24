// Types for the generated standalone validators (scripts/build-validators.ts).
import type { ErrorObject } from 'ajv';

export interface StandaloneValidator {
  (data: unknown): boolean;
  errors?: ErrorObject[] | null;
}

export declare const manifest: StandaloneValidator;
export declare const calendar: StandaloneValidator;
export declare const holidays: StandaloneValidator;
export declare const businessCalendar: StandaloneValidator;
export declare const adminUnits: StandaloneValidator;
export declare const boundaries: StandaloneValidator;
