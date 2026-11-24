import { type AdminUnitsFile, type Dataset, type Issue, type Manifest, type Result } from './types.ts';
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
/** Schema plus semantic checks for one data file of a known dataset. */
export declare function validateDataFile(dataset: Dataset, path: string, value: unknown, manifest: Manifest, adminUnits?: AdminUnitsFile): Issue[];
export declare function validateRelease(input: ReleaseInput, options?: ReleaseOptions): Promise<Result & {
    manifest?: Manifest;
}>;
