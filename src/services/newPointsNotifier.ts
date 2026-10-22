import type { NewPointsBySubject } from './sync/zaznamnikNewPoints';

/**
 * A one-slot registry so the sync can announce new záznamník points without
 * knowing who, if anyone, shows them as a system notification.
 *
 * Same inversion as `sessionExpiry.ts`: the sync handler is shared code, and
 * `@capacitor/local-notifications` must not reach the extension's graph. The
 * Capacitor bootstrap registers the notifier; the extension registers nothing
 * and keeps only the in-app highlight (pinned in src/test/guards).
 */
type NewPointsNotifier = (found: NewPointsBySubject) => void;

let notifier: NewPointsNotifier | null = null;

/** Registered by capacitor/startApp. Later calls replace the notifier. */
export function setNewPointsNotifier(fn: NewPointsNotifier | null): void {
  notifier = fn;
}

/** A no-op wherever no notifier is registered. */
export function notifyNewPoints(found: NewPointsBySubject): void {
  if (Object.keys(found).length > 0) notifier?.(found);
}
