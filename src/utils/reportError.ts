// Single entry point for non-fatal errors.
// - Always console.error with stack + extras (local debugging).
// - Forwards (context, err) to sendTelemetry — only the sanitized message is
//   transmitted; `extra` stays local. Safe to call before initTelemetry().

import { sendTelemetry } from '../services/errorReporter/telemetry';

export function logError(context: string, err: unknown, extra?: Record<string, unknown>): void {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const payload: Record<string, unknown> = { context, msg };
    if (stack) payload.stack = stack;
    if (extra) Object.assign(payload, extra);
    console.error(`[reIS:error] ${context}: ${msg}`, payload);
    sendTelemetry(context, err);
}
