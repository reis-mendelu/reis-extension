import { describe, it, expect, afterEach, vi } from 'vitest';
import { classifyNetworkFailure, isDeviceOffline } from './networkFailure';

/** What CapacitorHttp rejects with: the native message plus a `code`. */
function capacitorError(code: string, message: string) {
  return Object.assign(new Error(message), { code });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('classifyNetworkFailure', () => {
  // The message is the OS's localizedDescription — Czech on a Czech iPhone —
  // so the code is what the classification reads.
  it('reads iOS URLSession failures by their NSError domain', () => {
    const e = capacitorError('NSURLErrorDomain', 'Připojení k internetu je pravděpodobně offline.');
    expect(classifyNetworkFailure(e, true)).toBe('unreachable');
  });

  it.each([
    'UnknownHostException',
    'ConnectException',
    'SocketTimeoutException',
    'NoRouteToHostException',
    'SocketException',
  ])('reads the Android %s as a network failure', (code) => {
    expect(classifyNetworkFailure(capacitorError(code, 'whatever'), true)).toBe('unreachable');
  });

  it.each(['Failed to fetch', 'Load failed', 'NetworkError when attempting to fetch resource.'])(
    'reads the browser fetch rejection "%s" as a network failure',
    (message) => {
      expect(classifyNetworkFailure(new TypeError(message), true)).toBe('unreachable');
    }
  );

  it('calls any failure offline when the device says it is offline', () => {
    expect(classifyNetworkFailure(new Error('HTTP 500'), false)).toBe('offline');
  });

  // IS answering badly is not a network problem: the student's connection is
  // fine and the raw text stays the most honest thing to show.
  it.each([
    new Error('HTTP 500'),
    new Error('eduroam: certificate generation did not produce a certificate'),
    Object.assign(new Error('HTTP 401'), { sessionExpired: true }),
    capacitorError('SSLHandshakeException', 'handshake failed'),
    'a string',
    null,
  ])('leaves %s unclassified while online', (e) => {
    expect(classifyNetworkFailure(e, true)).toBeNull();
  });

  it('reads navigator.onLine when no online flag is passed', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(classifyNetworkFailure(new Error('x'))).toBe('offline');
  });
});

describe('isDeviceOffline', () => {
  it('is true only when navigator.onLine is explicitly false', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isDeviceOffline()).toBe(true);
    vi.stubGlobal('navigator', { onLine: true });
    expect(isDeviceOffline()).toBe(false);
    vi.stubGlobal('navigator', {});
    expect(isDeviceOffline()).toBe(false);
  });
});
