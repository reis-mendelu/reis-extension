// Single entry point for non-fatal errors.
// - A DemoModeError is not an error: every guarded path (fetchWithAuth,
//   fetchAuthedBytes, loadStoredToken, and the mobile action bridge for
//   openIsFileNatively) already catches into this one funnel, which makes it
//   the one place that sees a blocked demo tap regardless of which guard threw
//   it. Showing the toast and returning here means demo mode's "no network"
//   behaviour reads as an explained limitation, not a silently swallowed
//   failure or a silently swallowed one. The toast itself arrives through
//   `setDemoErrorHandler` rather than a static import — see that function for
//   why the difference is load-bearing.
// - Otherwise, console.error with stack + extras.
//
// Nothing here leaves the device. This used to forward every error to a
// Supabase RPC; that path is gone, along with the tables behind it. If you are
// adding transmission back, `src/test/guards/noStudentDataLeaves.test.ts` is
// where the decision is enforced, and it will fail first.
//
// It does keep a cleaned copy in `diagnostics/diagnosticLog` — memory only —
// which the report form attaches when, and only when, the student opts in.

import { recordDiagnostic, asLogErrorConsoleCall } from './diagnostics/diagnosticLog';

/**
 * Returns true when it has handled the error and logError should stop.
 * Registered by the Capacitor bootstrap; see `setDemoErrorHandler`.
 */
type DemoErrorHandler = (err: unknown) => boolean;

let demoErrorHandler: DemoErrorHandler | null = null;

/**
 * One-slot registry for the demo-mode toast, registered by the Capacitor
 * bootstrap. Inverted for the same reason as `services/sessionExpiry.ts`, and
 * this one is not merely a size concern.
 *
 * `logError` is called from essentially every module, including
 * `injector/messageHandler` — so a static import of `mobile/demoToast` put
 * sonner in the CONTENT SCRIPT's graph. sonner injects its stylesheet while
 * being evaluated, the content script runs at `document_start` when
 * `document.head` is null and `getElementsByTagName('head')[0]` is undefined,
 * and the resulting `Cannot read properties of undefined (reading
 * 'appendChild')` aborted the whole content script before `main()` ever
 * registered. The extension injected nothing on is.mendelu.cz.
 *
 * A registry, not a dynamic `import()`: `demoToast` explains that a dynamic
 * import fired the toast after the caller had already returned. A registered
 * function reference keeps `logError` fully synchronous, so that regression
 * does not come back with it.
 *
 * `scripts/lib/__tests__/contentScriptGraph.test.ts` fails if the static edge
 * is ever restored.
 */
export function setDemoErrorHandler(fn: DemoErrorHandler | null): void {
  demoErrorHandler = fn;
}

export function logError(context: string, err: unknown, extra?: Record<string, unknown>): void {
  if (demoErrorHandler?.(err)) return;

  const msg = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const payload: Record<string, unknown> = { context, msg };
  if (stack) payload.stack = stack;
  if (extra) Object.assign(payload, extra);
  // Kept in memory for the report form, which sends it only if the student
  // ticks "Přiložit technické údaje". Context, message and status only — the
  // stack and `extra` stay in the console.
  recordDiagnostic({ level: 'error', ctx: context, msg: err, status: statusOf(err) });
  asLogErrorConsoleCall(() => console.error(`[reIS:error] ${context}: ${msg}`, payload));
}

function statusOf(err: unknown): number | undefined {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : undefined;
}
