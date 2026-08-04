import { vi } from 'vitest';
import type { CapacitorTransportDeps } from '../capacitorTransport';

/** Not a suite — `vitest.config.ts` collects only `*.{test,spec}.*`. */

export const TOKEN = 'AAAAAAAAAAAAAAAAAAAAAAAA%2FBBBBBBBBBBBBBBBBBBB';

/**
 * The injected native layer. Defaults to android answering an AUTHENTICATED
 * HTML page, because that is the shape ~236 device-verified sync GETs actually
 * return — a test that needs anything else overrides one dep rather than
 * rebuilding the bag.
 */
export function deps(over: Partial<CapacitorTransportDeps> = {}): CapacitorTransportDeps {
  return {
    platform: 'android',
    setCookie: vi.fn(async () => {}),
    httpGet: vi.fn(async () => ({
      status: 200,
      data: '<a href="/system/logout.pl">x</a>',
      headers: { 'Content-Type': 'text/html' },
    })),
    httpPost: vi.fn(async () => ({
      status: 200,
      data: '<a href="/system/logout.pl">x</a>',
      headers: { 'Content-Type': 'text/html' },
    })),
    ...over,
  };
}

/** The options bag `fetchViaCapacitor` handed to the native call. */
export function sentTo(fn: CapacitorTransportDeps['httpGet'] | CapacitorTransportDeps['httpPost']) {
  return (fn as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
    url: string;
    headers: Record<string, string>;
    data?: string;
  };
}
