import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchViaCapacitor } from '../capacitorTransport';
import { setSessionExpiredHandler } from '../../services/sessionExpiry';

const deps = {
  platform: 'android' as const,
  setCookie: vi.fn(async () => {}),
  httpGet: vi.fn(),
  httpPost: vi.fn(),
};

/**
 * The notification lives in the error factory, not at a catch site, because
 * almost nothing catches these: search and the GET endpoints swallow into
 * null/[], and syncAllData wraps its fan-out in Promise.allSettled. Reporting
 * where the error is MINTED is the only point every unauthenticated response
 * passes through.
 */
describe('session expiry reaches the handler from the transport', () => {
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = vi.fn();
    setSessionExpiredHandler(handler);
  });

  it('notifies on a 401', async () => {
    deps.httpGet.mockResolvedValue({ status: 401, data: '', headers: {} });

    await expect(fetchViaCapacitor('https://is.mendelu.cz/auth/x', 'T', deps)).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // IS answers an unauthenticated request with a normal 200 login page, so this
  // is the common case in practice — not the 401.
  it('notifies on a 200 that is really a login page', async () => {
    deps.httpGet.mockResolvedValue({
      status: 200,
      data: '<html><body>please log in</body></html>',
      headers: { 'content-type': 'text/html' },
    });

    await expect(fetchViaCapacitor('https://is.mendelu.cz/auth/x', 'T', deps)).rejects.toThrow();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // A 5xx is IS being broken, not the student being logged out. Prompting for
  // a re-login over a transient outage would be actively wrong.
  it('stays silent on a server error', async () => {
    deps.httpGet.mockResolvedValue({ status: 503, data: '', headers: {} });

    await expect(fetchViaCapacitor('https://is.mendelu.cz/auth/x', 'T', deps)).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  // The handler discards stragglers by comparing this against the token it
  // last installed, so a notification that arrives without one cannot be
  // filtered and would re-prompt after a successful re-login.
  it.each([
    ['a 401', { status: 401, data: '', headers: {} }],
    [
      'an unauthenticated 200',
      { status: 200, data: '<html>login</html>', headers: { 'content-type': 'text/html' } },
    ],
  ])('forwards the token the failing request used on %s', async (_name, response) => {
    deps.httpGet.mockResolvedValue(response);

    await expect(
      fetchViaCapacitor('https://is.mendelu.cz/auth/x', 'DEAD-TOKEN', deps)
    ).rejects.toThrow();
    expect(handler).toHaveBeenCalledWith('DEAD-TOKEN');
  });

  it('stays silent on a healthy authenticated page', async () => {
    deps.httpGet.mockResolvedValue({
      status: 200,
      data: '<html><a href="/system/logout.pl">odhlásit</a></html>',
      headers: { 'content-type': 'text/html' },
    });

    await fetchViaCapacitor('https://is.mendelu.cz/auth/x', 'T', deps);
    expect(handler).not.toHaveBeenCalled();
  });
});
