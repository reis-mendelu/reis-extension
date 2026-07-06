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
  // Any email address — a non-MENDELU address (Erasmus contacts, gmail in
  // user-typed text) is still PII once paired with anything else.
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  // Any *.mendelu.cz URL (with or without query)
  /https?:\/\/(?:[\w-]+\.)*mendelu\.cz[^\s)]*/gi,
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
  // Defensive: if a non-extension path slips through, still scrub PII patterns.
  for (const re of PATTERNS) out = out.replace(re, REDACT);
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
  // safe: each regex has exactly one required capturing group
  if ((m = userAgent.match(/Edg\/(\d+)/))) return { name: 'Edge', version: m[1]! };
  if ((m = userAgent.match(/Firefox\/(\d+)/))) return { name: 'Firefox', version: m[1]! };
  if ((m = userAgent.match(/Chrome\/(\d+)/))) return { name: 'Chrome', version: m[1]! };
  if ((m = userAgent.match(/Version\/(\d+).*Safari/))) return { name: 'Safari', version: m[1]! };
  return { name: 'Unknown', version: '0' };
}

export function dedupeKey(
  errorType: string,
  message: string,
  filePath: string,
  lineNumber: number
): string {
  return `${errorType}|${message}|${filePath}|${lineNumber}`;
}

// Sanitize a stack trace string for telemetry. Keeps the top N frames so we
// can pinpoint the failing call site; everything below is rarely useful and
// just enlarges the payload. Each line passes through the same PATTERNS as
// the message, plus chrome-extension://… prefix stripping (same as filePath).
const MAX_STACK_FRAMES = 4;
const MAX_STACK_LEN = 1000;

export function sanitizeStack(input: unknown, maxFrames: number = MAX_STACK_FRAMES): string {
  if (typeof input !== 'string' || !input) return '';
  const lines = input.split('\n').slice(0, maxFrames + 1); // +1 to include the leading "Error: …" line
  const cleaned = lines
    .map((line) => {
      let out = line;
      // Strip extension origin from in-frame URLs.
      out = out.replace(/(chrome-extension|moz-extension):\/\/[a-z0-9-]+\//gi, '');
      for (const re of PATTERNS) out = out.replace(re, REDACT);
      return out.trim();
    })
    .filter(Boolean)
    .join(' | ');
  return cleaned.length > MAX_STACK_LEN ? cleaned.slice(0, MAX_STACK_LEN) : cleaned;
}
