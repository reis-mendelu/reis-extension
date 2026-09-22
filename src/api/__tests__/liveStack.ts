/**
 * Guard for the `*.live.test.ts` suites, which write to — and in one case
 * delete from — a real database over real HTTP.
 *
 * The suites are documented as pointing at a throwaway local stack
 * (docs/verify-engagement-signals.md), but documentation is not a mechanism:
 * exporting `REIS_LOCAL_PGRST_URL` with the wrong value would run a destructive
 * fixture against whatever it names. Production is one typo away, and the
 * blast radius there is society events, not test rows.
 *
 * So the host is checked, not trusted. Anything that is not loopback refuses to
 * run at all.
 */
const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function assertLocalStack(url: string): void {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`live suite: REIS_LOCAL_PGRST_URL is not a URL: ${url}`);
  }
  if (!LOOPBACK.has(host)) {
    throw new Error(
      `live suite refuses to run against "${host}". These tests insert and ` +
        `delete rows, and are only ever pointed at a disposable local stack — ` +
        `see docs/verify-engagement-signals.md. Nothing has been written.`
    );
  }
}
