/**
 * True only when `url` is an absolute https URL whose origin is exactly
 * https://is.mendelu.cz. Used to gate credentialed (cookie-bearing) fetches
 * in the content script.
 *
 * A substring/`startsWith` check is unsafe here: `startsWith('https://is.mendelu.cz')`
 * also matches `https://is.mendelu.cz.evil.com`, which would send the IS session
 * cookie to an attacker-controlled host. Comparing the parsed origin closes that gap.
 */
export function isIsMendeluUrl(url: string): boolean {
    try {
        return new URL(url).origin === 'https://is.mendelu.cz';
    } catch {
        return false;
    }
}
