import { DemoModeError, isDemoMode } from '../../errors/demoMode';

/**
 * Demo mode exists only on Capacitor today, and every caller below already sits
 * behind `isNativeHost()`, which routes Capacitor through `openNativeFile`
 * instead — so this can never trip in production. It stays here as defence in
 * depth, not a live bug fix: if demo mode ever reaches a non-native host, these
 * credentialed fetches must not become the way a reviewer's tap reaches a real
 * IS session.
 */
export function assertNotDemo(): void {
  if (isDemoMode()) throw new DemoModeError();
}
