/**
 * The thin layer between the WebISKAM transport and the parsers.
 *
 * The interesting question in every one of these is what happens when something
 * fails, and the answers deliberately differ:
 *
 *   - profile and reservations SWALLOW failures and return empty, because they
 *     are two of several panels on a dashboard and one broken panel must not
 *     blank the rest;
 *   - konta and ubytovani PROPAGATE, so an IskamAuthError reaches the handler
 *     that redirects the student to sign in again. Swallowing there would show
 *     an empty balance to someone who is merely logged out.
 *
 * That split is the behaviour worth pinning: getting it backwards either hides a
 * lapsed session or takes the whole page down for one bad table.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const requestIskam = vi.hoisted(() => vi.fn());
const fetchIskam = vi.hoisted(() => vi.fn());
const parseProfile = vi.hoisted(() => vi.fn());
const parsePendingPayments = vi.hoisted(() => vi.fn());
const parseReservations = vi.hoisted(() => vi.fn());
const parseUbytovani = vi.hoisted(() => vi.fn());
const parseKonta = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock('../client', () => ({
  requestIskam,
  fetchIskam,
  ISKAM_BASE: 'https://webiskam.mendelu.cz',
}));
vi.mock('../../../utils/parsers/iskam/profile', () => ({ parseProfile }));
vi.mock('../../../utils/parsers/iskam/pendingPayments', () => ({ parsePendingPayments }));
vi.mock('../../../utils/parsers/iskam/reservations', () => ({ parseReservations }));
vi.mock('../../../utils/parsers/iskam/ubytovani', () => ({ parseUbytovani }));
vi.mock('../../../utils/parsers/iskam/konta', () => ({ parseKonta }));
vi.mock('../../../utils/reportError', () => ({ logError }));

import { fetchProfileAndPayments } from '../profile';
import { fetchReservations } from '../reservations';
import { fetchUbytovani } from '../ubytovani';
import { fetchKonta } from '../konta';

beforeEach(() => {
  vi.clearAllMocks();
  requestIskam.mockResolvedValue('<html/>');
  fetchIskam.mockResolvedValue('<html/>');
});

describe('fetchProfileAndPayments', () => {
  it('reads both the profile and the payments from ONE request', async () => {
    // Both live on /InformaceOKlientovi. Fetching it twice would double the
    // latency of the dashboard for no gain.
    parseProfile.mockReturnValue({ name: 'Student' });
    parsePendingPayments.mockReturnValue([{ amount: '600 Kč' }]);

    const out = await fetchProfileAndPayments();

    expect(requestIskam).toHaveBeenCalledTimes(1);
    expect(requestIskam).toHaveBeenCalledWith('/InformaceOKlientovi');
    expect(out).toEqual({ profile: { name: 'Student' }, pendingPayments: [{ amount: '600 Kč' }] });
  });

  it('returns empties and reports when the request fails', async () => {
    requestIskam.mockRejectedValue(new Error('offline'));

    const out = await fetchProfileAndPayments();

    expect(out).toEqual({ profile: null, pendingPayments: [] });
    expect(logError).toHaveBeenCalledWith(
      'Iskam.fetchProfileAndPayments:network',
      expect.any(Error)
    );
  });

  it('still returns the payments when the PROFILE parser throws', async () => {
    // The two parsers are independent; one brittle table must not cost the
    // student the other. This is the isolation that makes the dashboard degrade
    // rather than disappear.
    parseProfile.mockImplementation(() => {
      throw new Error('profile markup changed');
    });
    parsePendingPayments.mockReturnValue([{ amount: '600 Kč' }]);

    const out = await fetchProfileAndPayments();

    expect(out.profile).toBeNull();
    expect(out.pendingPayments).toEqual([{ amount: '600 Kč' }]);
    expect(logError).toHaveBeenCalledWith('Iskam.parseProfile', expect.any(Error));
  });

  it('still returns the profile when the PAYMENTS parser throws', async () => {
    parseProfile.mockReturnValue({ name: 'Student' });
    parsePendingPayments.mockImplementation(() => {
      throw new Error('payments markup changed');
    });

    const out = await fetchProfileAndPayments();

    expect(out.profile).toEqual({ name: 'Student' });
    expect(out.pendingPayments).toEqual([]);
    expect(logError).toHaveBeenCalledWith('Iskam.parsePendingPayments', expect.any(Error));
  });
});

describe('fetchReservations', () => {
  it('parses the reservations page', async () => {
    parseReservations.mockReturnValue([{ id: 'r1' }]);

    await expect(fetchReservations()).resolves.toEqual([{ id: 'r1' }]);
    expect(requestIskam).toHaveBeenCalledWith('/Rezervace');
  });

  it('degrades to an empty list and reports, rather than throwing', async () => {
    requestIskam.mockRejectedValue(new Error('offline'));

    await expect(fetchReservations()).resolves.toEqual([]);
    expect(logError).toHaveBeenCalledWith('Iskam.fetchReservations', expect.any(Error));
  });
});

describe('fetchKonta', () => {
  it('passes the language to BOTH the request and the parser', async () => {
    // The parser tags each row's name with the language it was read in; handing
    // it a different one than was fetched mislabels every account.
    parseKonta.mockReturnValue([{ name: 'Hlavní konto' }]);

    await fetchKonta('en');

    expect(fetchIskam).toHaveBeenCalledWith('/Konta', 'en');
    expect(parseKonta).toHaveBeenCalledWith('<html/>', 'en');
  });

  it('defaults to Czech', async () => {
    parseKonta.mockReturnValue([]);

    await fetchKonta();

    expect(fetchIskam).toHaveBeenCalledWith('/Konta', 'cz');
    expect(parseKonta).toHaveBeenCalledWith('<html/>', 'cz');
  });

  it('PROPAGATES a failure instead of showing an empty balance', async () => {
    // An IskamAuthError has to reach the handler that redirects to sign in.
    // Returning [] here would render "0 Kč" to a student who is simply logged out.
    fetchIskam.mockRejectedValue(new Error('IskamAuthError'));

    await expect(fetchKonta()).rejects.toThrow();
  });
});

describe('fetchUbytovani', () => {
  it('requests the accommodation overview in the requested language', async () => {
    parseUbytovani.mockReturnValue([{ dorm: 'Kolej Akademie' }]);

    await expect(fetchUbytovani('en')).resolves.toEqual([{ dorm: 'Kolej Akademie' }]);
    expect(fetchIskam).toHaveBeenCalledWith('/PrehledUbytovani', 'en');
  });

  it('propagates a failure', async () => {
    fetchIskam.mockRejectedValue(new Error('IskamAuthError'));

    await expect(fetchUbytovani()).rejects.toThrow();
  });
});
