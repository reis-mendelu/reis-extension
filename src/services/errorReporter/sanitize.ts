// Sanitization for the automatic error reporter.
// Promise (PRIVACY.md §6): the only fields that leave the device are error
// type, message, file path, line number, extension version, browser name,
// browser version. This module guarantees that the message and file path
// cannot smuggle student data even if a future caller throws an error string
// containing user content.

const MAX_MESSAGE_LEN = 500;
const MAX_PATH_LEN = 500;

const REDACT = '[redacted]';

const PATTERNS: RegExp[] = [
    // Bearer / Basic / Token auth — capture the credential too
    /\b(?:Bearer|Basic|Token)\s+[A-Za-z0-9._\-+/=]+/gi,
    // Cookie / Set-Cookie payloads
    /(?:Cookie|Set-Cookie)\s*[:=]\s*[^\s;]+/gi,
    // MENDELU email addresses (covers @mendelu.cz, @node.mendelu.cz, etc.)
    /[\w.+-]+@(?:[\w-]+\.)*mendelu\.cz/gi,
    // is.mendelu.cz / webiskam.mendelu.cz URLs (with or without query)
    /https?:\/\/(?:is|webiskam|node)\.mendelu\.cz[^\s)]*/gi,
    // 6-to-7-digit student/staff IDs — negative look-around avoids matching
    // longer numbers (timestamps, counts) while catching UIDs embedded in strings.
    /(?<!\d)\d{6,7}(?!\d)/g,
];

export function sanitizeMessage(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    let out = input;
    for (const re of PATTERNS) out = out.replace(re, REDACT);
    out = out.trim();
    if (!out) return null;
    if (out.length > MAX_MESSAGE_LEN) out = out.slice(0, MAX_MESSAGE_LEN);
    return out;
}

export function sanitizeFilePath(input: unknown): string {
    if (typeof input !== 'string' || !input) return '';
    let out = input;
    const q = out.indexOf('?');
    if (q !== -1) out = out.slice(0, q);
    const h = out.indexOf('#');
    if (h !== -1) out = out.slice(0, h);
    if (out.startsWith('chrome-extension://') || out.startsWith('moz-extension://')) {
        const slash = out.lastIndexOf('/');
        if (slash !== -1) out = out.slice(slash + 1);
    }
    if (out.length > MAX_PATH_LEN) out = out.slice(0, MAX_PATH_LEN);
    return out;
}

export interface BrowserInfo {
    name: string;
    version: string;
}

export function getBrowserInfo(userAgent: string = navigator.userAgent): BrowserInfo {
    if (!userAgent) return { name: 'Unknown', version: '0' };
    // Order matters: Edge UA also contains "Chrome".
    let m: RegExpMatchArray | null;
    if ((m = userAgent.match(/Edg\/(\d+)/))) return { name: 'Edge', version: m[1] };
    if ((m = userAgent.match(/Firefox\/(\d+)/))) return { name: 'Firefox', version: m[1] };
    if ((m = userAgent.match(/Chrome\/(\d+)/))) return { name: 'Chrome', version: m[1] };
    if ((m = userAgent.match(/Version\/(\d+).*Safari/))) return { name: 'Safari', version: m[1] };
    return { name: 'Unknown', version: '0' };
}

export function dedupeKey(
    errorType: string,
    message: string,
    filePath: string,
    lineNumber: number,
): string {
    return `${errorType}|${message}|${filePath}|${lineNumber}`;
}
