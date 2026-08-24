// Single entry point for non-fatal errors.
// - A DemoModeError is not an error: every guarded path (fetchWithAuth,
//   fetchAuthedBytes, loadStoredToken, and the mobile action bridge for
//   openIsFileNatively) already catches into this one funnel, which makes it
//   the one place that sees a blocked demo tap regardless of which guard threw
//   it. Showing the toast and returning here means demo mode's "no network"
//   behaviour reads as an explained limitation, not a silently swallowed
//   failure or a telemetry report about an intentional block.
// - Otherwise, always console.error with stack + extras (local debugging).
// - Forwards (context, err) to sendTelemetry — only the sanitized message is
//   transmitted; `extra` stays local. Safe to call before initTelemetry().

import { sendTelemetry } from '../services/errorReporter/telemetry';
import { handleDemoError } from '../mobile/demoToast';

export function logError(context: string, err: unknown, extra?: Record<string, unknown>): void {
    if (handleDemoError(err)) return;

    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const payload: Record<string, unknown> = { context, msg };
    if (stack) payload.stack = stack;
    if (extra) Object.assign(payload, extra);
    console.error(`[reIS:error] ${context}: ${msg}`, payload);
    try {
        sendTelemetry(context, err);
    } catch (telemetryErr) {
        console.warn('[reIS:error] telemetry dispatch failed', telemetryErr);
    }
}
