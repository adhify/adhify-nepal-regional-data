// Checksums and signatures with Web Crypto only, so the same code runs in Node, browsers and
// Workers (ADR 0002). Signing happens in the publishing pipeline (R1.5), not here.
export async function sha256Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
function fromBase64(value) {
    try {
        return Uint8Array.from(atob(value.trim()), (c) => c.charCodeAt(0));
    }
    catch {
        return null;
    }
}
/**
 * Verifies `manifest.sig` (base64 Ed25519 signature of the exact `manifest.json` bytes) against
 * any of the trusted raw 32-byte public keys. Keys rotate yearly; old keys stay trusted for old
 * releases.
 */
export async function verifyManifestSignature(manifest, signatureBase64, publicKeys) {
    const signature = fromBase64(signatureBase64);
    if (!signature || signature.length !== 64)
        return false;
    for (const raw of publicKeys) {
        if (raw.length !== 32)
            continue;
        const key = await crypto.subtle.importKey('raw', raw, 'Ed25519', false, [
            'verify',
        ]);
        if (await crypto.subtle.verify('Ed25519', key, signature, manifest)) {
            return true;
        }
    }
    return false;
}
