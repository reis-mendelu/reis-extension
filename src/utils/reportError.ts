// Single chokepoint for non-fatal errors that previously vanished into
// `.catch(() => {})`. Keeps a stable prefix so production reports are greppable.

export function reportError(context: string, err: unknown, extra?: Record<string, unknown>): void {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const payload: Record<string, unknown> = { context, msg };
    if (stack) payload.stack = stack;
    if (extra) Object.assign(payload, extra);
    console.error(`[reIS:error] ${context}: ${msg}`, payload);
}
