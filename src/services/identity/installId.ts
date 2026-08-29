import { IndexedDBService } from '../storage';

const KEY = 'install_id';

/**
 * A random, per-install identifier — deliberately NOT derived from the student.
 *
 * reIS used to key server-side rows on SHA-256 of the IS student id. That is not
 * anonymisation: student ids are six or seven digits, so the entire preimage
 * space is under ten million and a rainbow table builds in seconds. The hash was
 * therefore a recoverable student identifier, which is exactly what reIS
 * promises never to send anywhere.
 *
 * A random 128-bit UUID has no relationship to the person. It buys the two
 * things the server genuinely needs — "count this device once" and "let this
 * device change or withdraw its own answer" — without any of the identity.
 *
 * The trade is honest and deliberate: this counts INSTALLS, not people. One
 * student on a phone and a tablet is two, and a reinstall is a third. Where a
 * per-person number matters, ask the student directly rather than inferring it.
 */
let cached: Promise<string> | null = null;

export function getInstallId(): Promise<string> {
  if (cached) return cached;
  cached = (async () => {
    const existing = await IndexedDBService.get('meta', KEY);
    if (typeof existing === 'string' && existing.length > 0) return existing;
    const fresh = crypto.randomUUID();
    await IndexedDBService.set('meta', KEY, fresh);
    return fresh;
  })().catch((err) => {
    // Never cache a failure: a transient IDB error must not pin this install to
    // a broken state for the rest of the session.
    cached = null;
    throw err;
  });
  return cached;
}

/** Test-only: drop the memoised id. */
export function __resetInstallIdForTests(): void {
  cached = null;
}
