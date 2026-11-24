import type { Dataset, Issue } from './types.ts';
/** Validates `value` against the manifest schema or a dataset's file schema. */
export declare function checkSchema(kind: Dataset | 'manifest', file: string, value: unknown): Issue[];
