import { resolveDevClockOffset } from '../../src/utils/resolveDevClockOffset';

/**
 * The moment a fixture should be rebased against.
 *
 * Normally the real clock. With `?now=` — on the request, or on the page the
 * request came from — the moment that param names, so the server stamps
 * lessons and terms on the same clock `dev/clockOverride` gives the app. Two
 * clocks would put a lesson authored "running now" at the real hour while the
 * app believes another.
 */
export function fixtureNow(url: string, referer: string | undefined, realNow: Date): Date {
  const param = readNow(url) ?? readNow(referer);
  const offset = resolveDevClockOffset(param ?? null, realNow);
  return offset === null ? realNow : new Date(realNow.getTime() + offset);
}

function readNow(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    // A base for the request path, which arrives relative; a full referer URL
    // ignores it.
    return new URL(raw, 'http://localhost').searchParams.get('now');
  } catch {
    return null;
  }
}
