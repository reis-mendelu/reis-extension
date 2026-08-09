import { describe, it, expect, vi, afterEach } from 'vitest';
import { getAppVersion, getHostLabel } from '../appIdentity';
import { __resetPlatformForTests } from '../../platform';

const CHROME_STUB = {
  storage: {},
  runtime: { id: 'test-extension-id', getManifest: () => ({ version: '1.0.0' }) },
};

describe('appIdentity', () => {
  afterEach(() => {
    vi.stubGlobal('chrome', CHROME_STUB);
    __resetPlatformForTests();
  });

  it('reads the version from the extension manifest when there is one', () => {
    vi.stubGlobal('chrome', CHROME_STUB);
    expect(getAppVersion()).toBe('1.0.0');
  });

  it('falls back to a build-injected version off the extension', () => {
    // `__REIS_APP_VERSION__` is only defined by the Capacitor and dev-webapp
    // Vite builds, and vitest defines neither — so this asserts the guard
    // itself: no manifest and no define must not throw, and must not claim a
    // version it does not have.
    vi.stubGlobal('chrome', undefined);
    expect(getAppVersion()).toBe('0.0.0');
  });

  /**
   * The branch the APP actually takes. Vitest defines no `__REIS_APP_VERSION__`,
   * so without stubbing it the suite only ever exercised the `0.0.0` guard —
   * and `0.0.0` is the exact marker telemetry uses for "orphaned, unactionable",
   * which is what every mobile report carried before this. Worth pinning that
   * the injected value is preferred, not just that the fallback is safe.
   */
  it('prefers the build-injected version off the extension', () => {
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('__REIS_APP_VERSION__', '5.0.0');
    expect(getAppVersion()).toBe('5.0.0');
    vi.unstubAllGlobals();
  });

  it('reports the extension host when a chrome runtime is present', () => {
    vi.stubGlobal('chrome', CHROME_STUB);
    __resetPlatformForTests();
    expect(getHostLabel()).toBe('extension');
  });

  it('never throws when no platform has been installed', () => {
    // getPlatform() throws by design in that case. A report is the last thing
    // that should turn a boot-order bug into a second, louder failure.
    vi.stubGlobal('chrome', undefined);
    __resetPlatformForTests();
    expect(getHostLabel()).toBe('web');
  });
});
