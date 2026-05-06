// Explicit telemetry transport — call sendTelemetry() at known error sites
// instead of relying on the automatic unhandled-exception reporter.
// No `extra` parameter by design: all student-data risk lives in extra fields.
// Must call initTelemetry() once at iframe boot before any sendTelemetry() call.

import { supabase } from '../spolky/supabaseClient';
import { sanitizeMessage, dedupeKey, getBrowserInfo } from './sanitize';

const SESSION_CAP = 3;

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

        const key = dedupeKey(context, message, '', 0);
        if (seen.has(key)) return;
        seen.add(key);
        if (reportsSent >= SESSION_CAP) return;
        reportsSent++;

        const browser = getBrowserInfo();
        void supabase.rpc('report_error', {
            p_error_type: context,
            p_error_message: message,
            p_file_path: '',
            p_line_number: 0,
            p_ext_version: getExtVersion(),
            p_browser_name: browser.name,
            p_browser_version: browser.version,
        }).then(() => {}, () => {});
    };
}

export function sendTelemetry(context: string, err: unknown): void {
    _send?.(context, err);
}
