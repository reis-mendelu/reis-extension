import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLibraryBooking } from '@/api/libraryBooking';
import type { BookingRequest } from '@/types/library';

afterEach(() => vi.restoreAllMocks());

const req: BookingRequest = {
  serviceId: 's1',
  staffMemberId: 'g1',
  startDateTime: '2026-07-20T14:00:00',
  endDateTime: '2026-07-20T15:00:00',
  customer: { name: 'Jan Novák', email: 'xnovak@mendelu.cz', studentId: '123456' },
};

const resp = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('createLibraryBooking', () => {
  it('returns the appointmentId on success', async () => {
    vi.stubGlobal('fetch', resp({ ok: true, appointmentId: 'abc123' }));
    expect(await createLibraryBooking(req)).toEqual({ ok: true, appointmentId: 'abc123' });
  });

  it('maps a 409 to a conflict error', async () => {
    vi.stubGlobal('fetch', resp({ error: 'conflict' }, 409));
    expect(await createLibraryBooking(req)).toEqual({ ok: false, error: 'conflict' });
  });

  it('maps a 429 to rate_limited', async () => {
    vi.stubGlobal('fetch', resp({ error: 'rate_limited' }, 429));
    expect(await createLibraryBooking(req)).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('maps other non-2xx to upstream', async () => {
    vi.stubGlobal('fetch', resp({ error: 'boom' }, 500));
    expect(await createLibraryBooking(req)).toEqual({ ok: false, error: 'upstream' });
  });

  it('maps a thrown fetch (network) to offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    expect(await createLibraryBooking(req)).toEqual({ ok: false, error: 'offline' });
  });
});
