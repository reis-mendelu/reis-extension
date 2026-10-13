/**
 * Sign-out steps for logins that only the phone/iPad app has, registered by the
 * Capacitor entry at boot rather than imported here.
 *
 * `mobile/signOut.ts` is reachable from shared code (`api/proxyClient.ts`), so
 * anything it imports lands in the extension's and reIS for Claude's graphs too.
 * The WebISKAM login (`mobile/iskam/clearIskam`) must not: reIS for Claude
 * handles a password and may reach no new POST. So signOut asks this list, which
 * imports nothing, and `capacitor/main.capacitor.tsx` fills it. Everywhere else
 * it is empty and the step is a no-op.
 */
type Cleanup = () => Promise<void>;

const cleanups: Cleanup[] = [];

export function registerSignOutCleanup(cleanup: Cleanup): void {
  cleanups.push(cleanup);
}

/** Runs every cleanup; one failing does not skip the others, and is rethrown. */
export async function runSignOutCleanups(): Promise<void> {
  const results = await Promise.allSettled(cleanups.map((c) => c()));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) throw failed.reason;
}

/** Tests only. */
export function __resetSignOutCleanupsForTests(): void {
  cleanups.length = 0;
}
