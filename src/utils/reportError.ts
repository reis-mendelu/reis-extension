// Console logger for non-fatal errors. Use sendTelemetry() to also forward
// to Supabase — logError() is console-only and never transmits data.

export function logError(context: string, err: unknown, extra?: Record<string, unknown>): void {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const payload: Record<string, unknown> = { context, msg };
    if (stack) payload.stack = stack;
    if (extra) Object.assign(payload, extra);
    console.error(`[reIS:error] ${context}: ${msg}`, payload);
}
