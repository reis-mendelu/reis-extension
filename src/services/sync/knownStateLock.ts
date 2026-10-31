/**
 * One lock for the "what has this device already seen" records (new boxes,
 * záznamník points, exam terms).
 *
 * The foreground app and the Android background check are two WebViews on one
 * IndexedDB, and each persist function reads the record, compares, then writes
 * it back. Their in-context queues cannot see each other, so two reads of the
 * same old record could both announce the same item. Web Locks are shared
 * across them (same origin), so the compare-and-write waits its turn here.
 * Without Web Locks (an old WebView) there is nothing to share with: the job
 * simply runs, as before.
 */
const LOCK = 'reis-known-state';

export function withKnownStateLock<T>(job: () => Promise<T>): Promise<T> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks;
  return locks ? (locks.request(LOCK, job) as Promise<T>) : job();
}
