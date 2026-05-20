// Explicit telemetry transport — call sendTelemetry() at known error sites
// instead of relying on the automatic unhandled-exception reporter.
// No `extra` parameter by design: all student-data risk lives in extra fields.
// Must call initTelemetry() once at iframe boot before any sendTelemetry() call.

import { supabase } from '../spolky/supabaseClient';
import { sanitizeMessage, sanitizeStack, dedupeKey, getBrowserInfo } from './sanitize';

const SESSION_CAP = 3;

// Anonymous per-iframe-load identifier. Held only in module memory; a page
// reload generates a new one. Lets us distinguish "1 user × N errors" from
// "N users × 1 error" without ever identifying anyone. See PRIVACY.md §6.
const SESSION_ID: string = (() => {
    try {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch { /* fall through */ }
    // Fallback: random 32-hex; only fires on browsers without crypto.randomUUID
    // (none of our supported targets, but a defensive default beats throwing).
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
})();

// Expected error patterns — log locally but never transmit. These are UX states
// or browser-level cancellations, not bugs:
//   - HTTP 401/403: user not logged in / session expired
//   - AbortError: host page navigated mid-fetch (browser cancels in-flight requests)
function isExpectedError(message: string): boolean {
    return (
        /HTTP 40[13]\b/.test(message) ||
        /Authentication required/.test(message) ||
        /\bAbortError\b/.test(message) ||
        /The (operation|user) aborted/.test(message)
    );
}

function getExtVersion(): string {
    try { return chrome?.runtime?.getManifest?.().version ?? '0.0.0'; } catch { return '0.0.0'; }
}

let _send: ((context: string, err: unknown) => void) | null = null;

export function initTelemetry(getEnabled: () => boolean): void {
    let reportsSent = 0;
    const seen = new Set<string>();

    _send = (context: string, err: unknown): void => {
        if (!getEnabled()) return;
        if (typeof navigator !== 'undefined' && navigator.webdriver) return;
        if (import.meta.env?.DEV && import.meta.env?.MODE !== 'test') return;

        const rawMessage = err instanceof Error ? err.message : String(err);
        const message = sanitizeMessage(rawMessage);
        if (!message) return;
        if (isExpectedError(message)) return;

        const key = dedupeKey(context, message, '', 0);
        if (seen.has(key)) return;
        seen.add(key);
        if (reportsSent >= SESSION_CAP) return;
        reportsSent++;

        const rawStack = err instanceof Error ? err.stack : undefined;
        const stackExcerpt = sanitizeStack(rawStack);
        const browser = getBrowserInfo();
        void supabase.rpc('report_error_v2', {
            p_session_id: SESSION_ID,
            p_error_type: context,
            p_error_message: message,
            p_file_path: '',
            p_line_number: 0,
            p_stack_excerpt: stackExcerpt,
            p_client_ts: new Date().toISOString(),
            p_ext_version: getExtVersion(),
            p_browser_name: browser.name,
            p_browser_version: browser.version,
        }).then(() => {}, () => {});
    };
}

export function sendTelemetry(context: string, err: unknown): void {
    _send?.(context, err);
}
