import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BOOKINGS_BASE } from '../bookingsBase';

interface Timeouts {
  connectTimeout?: number;
  readTimeout?: number;
}

const { request } = vi.hoisted(() => ({
  request: vi.fn(async (_opts: Timeouts) => ({ status: 200, data: {} })),
}));

vi.mock('../../../platform', () => ({ getPlatform: () => ({ kind: 'capacitor' }) }));
vi.mock('@capacitor/core', () => ({ CapacitorHttp: { request } }));

import { nativeBookingsHttp } from '../transport';

/**
 * Capacitor's iOS HttpRequestHandler sets ONE timeout for the whole request:
 * `(connectTimeout ?? readTimeout ?? 600000) / 1000`. A short connectTimeout
 * therefore silently replaces readTimeout on iPhone and iPad. On 2026-11-17 the
 * cabled iPad gave up on GetStaffAvailability after exactly 10 s
 * (`timeouts(10.0, …)`, NSURLError -1001) while the library's Bookings answered
 * in 14.7 s, so the card said "Rezervace se teď nepodařilo načíst". Android keeps
 * the two apart, which is why the Pixel worked.
 */
function iosTimeoutMs(opts: Timeouts): number {
  return opts.connectTimeout ?? opts.readTimeout ?? 600_000;
}

describe('nativeBookingsHttp timeouts on iOS', () => {
  beforeEach(() => request.mockClear());

  it('waits at least 45 s for availability, which takes 8 to 15 s', async () => {
    await nativeBookingsHttp({
      method: 'POST',
      url: `${BOOKINGS_BASE}/GetStaffAvailability`,
      headers: {},
      data: {},
    });
    const opts = request.mock.calls[0]?.[0];
    expect(opts).toBeDefined();
    expect(iosTimeoutMs(opts ?? {})).toBeGreaterThanOrEqual(45_000);
  });

  it('waits at least 120 s for a booking or a cancel', async () => {
    await nativeBookingsHttp({
      method: 'POST',
      url: `${BOOKINGS_BASE}/appointments`,
      headers: {},
      data: {},
    });
    await nativeBookingsHttp({
      method: 'DELETE',
      url: `${BOOKINGS_BASE}/appointments/x`,
      headers: {},
    });
    expect(request).toHaveBeenCalledTimes(2);
    for (const [opts] of request.mock.calls) {
      expect(iosTimeoutMs(opts)).toBeGreaterThanOrEqual(120_000);
    }
  });
});
