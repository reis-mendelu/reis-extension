import { toast } from 'sonner';
import { DemoModeError } from '../errors/demoMode';
import { translate } from '../i18n/translate';

/**
 * Call from a catch. Returns true if it handled the error, false if the caller
 * should keep unwinding — a real network failure must not be reported as "this
 * is only a demo".
 *
 * `translate` rather than the `useTranslation` hook: this runs from catch
 * blocks, not from render. That is the same reason `promptSessionRecovery`
 * uses it (`src/mobile/sessionRecovery.ts:169`).
 *
 * The store is imported **dynamically**, and that is load-bearing rather than
 * stylistic. `logError` calls this, and a dozen store slices call `logError`,
 * so a static `import { useAppStore }` here closes a cycle —
 * slice → reportError → demoToast → useAppStore → slice — which leaves the
 * store undefined at module-evaluation time and breaks every slice that
 * imports logError (it took out createMapSlice and createAdminSlice in CI).
 * Deferring the import breaks the cycle; the toast is fire-and-forget, so
 * showing it a microtask later costs nothing.
 */
export function handleDemoError(error: unknown): boolean {
  if (!(error instanceof DemoModeError)) return false;

  void import('../store/useAppStore').then(({ useAppStore }) => {
    toast(translate(useAppStore.getState().language, 'demo.toast'));
  });

  return true;
}
