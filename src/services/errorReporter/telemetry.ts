// Explicit telemetry transport — call sendTelemetry() at known error sites
// instead of relying on the automatic unhandled-exception reporter.
// No `extra` parameter by design: all student-data risk lives in extra fields.
// Must call initTelemetry() once at iframe boot before any sendTelemetry() call.

import { supabase } from '../spolky/supabaseClient';
import { getAppVersion, getHostLabel } from '../../utils/appIdentity';
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
  } catch {
    /* fall through */
  }
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

/**
 * Tags reports from the native app so phone failures can be told apart from
 * desktop ones — a UA check cannot do it, because the Android WebView reports
 * itself as Chrome and the iOS one as Safari.
 *
 * Purely additive: the extension's own `p_browser_name` is byte-identical to
 * what it has always sent, and only the app produces the new value.
 */
function hostSuffix(): string {
  return getHostLabel() === 'app' ? ' (reIS app)' : '';
}

// After an extension update, an orphaned iframe keeps running but loses its
// chrome.runtime binding: chrome.runtime.id goes undefined and IDB/chrome.* ops
// fail with "connection is closing" / "Extension context invalidated". These
// reports are unactionable noise — the context is dead and cannot be fixed from
// within. (Empirically ~77% of the IDB-closing telemetry, all reporting
// ext_version 0.0.0 because getManifest() throws.) Drop them at the funnel.
//
// ONLY an extension has such a context. The Capacitor app and the dev webapp
// have no `chrome` object at all, and reading the absence of chrome.runtime.id
// as "dead context" silently discarded every report the phone app ever
// produced — so a device run that showed zero telemetry proved nothing about
// the app's health. The check is now explicitly about the extension host.
function isContextAlive(): boolean {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime) return true;
    return Boolean(chrome.runtime.id);
  } catch {
    // Touching an invalidated chrome.runtime throws; that IS the dead case.
    return false;
  }
}

let _send: ((context: string, err: unknown) => void) | null = null;

export function initTelemetry(getEnabled: () => boolean): void {
  let reportsSent = 0;
  const seen = new Set<string>();

  _send = (context: string, err: unknown): void => {
    if (!getEnabled()) return;
    if (typeof navigator !== 'undefined' && navigator.webdriver) return;
    if (!isContextAlive()) return; // extension context invalidated — unactionable
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
    void supabase
      .rpc('report_error_v2', {
        p_session_id: SESSION_ID,
        p_error_type: context,
        p_error_message: message,
        p_file_path: '',
        p_line_number: 0,
        p_stack_excerpt: stackExcerpt,
        p_client_ts: new Date().toISOString(),
        p_ext_version: getAppVersion(),
        p_browser_name: `${browser.name}${hostSuffix()}`,
        p_browser_version: browser.version,
      })
      .then(
        () => {},
        () => {}
      );
  };
}

export function sendTelemetry(context: string, err: unknown): void {
  _send?.(context, err);
}
