export declare function sha256Hex(bytes: Uint8Array): Promise<string>;
/**
 * Verifies `manifest.sig` (base64 Ed25519 signature of the exact `manifest.json` bytes) against
 * any of the trusted raw 32-byte public keys. Keys rotate yearly; old keys stay trusted for old
 * releases.
 */
export declare function verifyManifestSignature(manifest: Uint8Array, signatureBase64: string, publicKeys: readonly Uint8Array[]): Promise<boolean>;
