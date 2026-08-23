import { toast } from 'sonner';
import { DemoModeError } from '../errors/demoMode';
import { translate } from '../i18n/translate';
import { useAppStore } from '../store/useAppStore';

/**
 * Call from a catch. Returns true if it handled the error, false if the caller
 * should keep unwinding — a real network failure must not be reported as "this
 * is only a demo".
 *
 * `translate` rather than the `useTranslation` hook: this runs from catch
 * blocks, not from render. That is the same reason `promptSessionRecovery`
 * uses it (`src/mobile/sessionRecovery.ts:169`).
 */
export function handleDemoError(error: unknown): boolean {
  if (!(error instanceof DemoModeError)) return false;
  toast(translate(useAppStore.getState().language, 'demo.toast'));
  return true;
}
