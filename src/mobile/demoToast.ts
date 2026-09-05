import { toast } from 'sonner';
import { DemoModeError } from '../errors/demoMode';
import { translate } from '../i18n/translate';
import { getCurrentLanguage } from '../i18n/currentLanguage';

/**
 * Call from a catch. Returns true if it handled the error, false if the caller
 * should keep unwinding — a real network failure must not be reported as "this
 * is only a demo".
 *
 * `translate` rather than the `useTranslation` hook: this runs from catch
 * blocks, not from render. That is the same reason `promptSessionRecovery`
 * uses it (`src/mobile/sessionRecovery.ts:169`).
 *
 * The language comes from `getCurrentLanguage` rather than the store, and that
 * is load-bearing. `logError` calls this and a dozen slices call `logError`,
 * so importing `useAppStore` here closes the cycle slice → reportError →
 * demoToast → useAppStore → slice, which leaves the store undefined at module
 * evaluation. Importing it dynamically broke the cycle but bought a worse
 * problem: the toast then fired after the caller had returned, which in tests
 * is after the environment is torn down ("window is not defined"). A plain
 * module-level value is synchronous and has no edge back into the store.
 */
export function handleDemoError(error: unknown): boolean {
  if (!(error instanceof DemoModeError)) return false;

  toast(translate(getCurrentLanguage(), 'demo.toast'), { id: 'demo-mode-notice' });
  return true;
}
