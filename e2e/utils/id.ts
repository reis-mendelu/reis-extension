import * as crypto from 'crypto';

/**
 * Calculates the Chrome extension ID from the public key in manifest.json
 * Algorithm:
 * 1. Hash the key using SHA256
 * 2. Take the first 32 hex characters
 * 3. Map 0-f to a-p
 * 
 * @param key The base64 encoded public key from manifest.json
 * @returns The 32-character extension ID
 */
export function calculateExtensionId(key: string): string {
    const hash = crypto.createHash('sha256')
        .update(Buffer.from(key, 'base64'))
        .digest('hex');
    
    return hash.slice(0, 32)
        .split('')
        .map(c => String.fromCharCode(parseInt(c, 16) + 'a'.charCodeAt(0)))
        .join('');
}
