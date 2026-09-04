import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getPlatformMock = vi.fn();
const capacitorPlatform = vi.fn<() => string>();

vi.mock('../../platform', () => ({ getPlatform: () => getPlatformMock() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => capacitorPlatform() } }));

/**
 * Which map vocabulary the device speaks, and the one that used to be guessed.
 *
 * This read `Capacitor.getPlatform() === 'android' ? 'android' : 'ios'`, so
 * every value that was not `android` — including Capacitor's own `web` —
 * claimed to be an iPhone. `mapAppOptions` then offered Apple / Google / ask on
 * a platform where `openVenue` resolves one URL and never consults the
 * preference: a setting with no effect, which is worse than no setting.
 */
describe('nativeMapPlatform', () => {
  beforeEach(() => {
    vi.resetModules();
    getPlatformMock.mockReturnValue({ kind: 'capacitor' });
  });

  afterEach(() => vi.unstubAllGlobals());

  const read = async () => (await import('../nativeMapPlatform')).nativeMapPlatform();

  it.each(['ios', 'android'] as const)('reports %s as itself', async (os) => {
    capacitorPlatform.mockReturnValue(os);
    expect(await read()).toBe(os);
  });

  // The regression: Capacitor can answer `web` even inside our capacitor host.
  it('reports Capacitor web as web, not as iOS', async () => {
    capacitorPlatform.mockReturnValue('web');
    expect(await read()).toBe('web');
  });

  // A platform added after this code was written must not be read as an iPhone
  // either — the same fail-safe direction `nativeEduroamTarget` takes.
  it('treats an unknown platform as web', async () => {
    capacitorPlatform.mockReturnValue('visionos');
    expect(await read()).toBe('web');
  });

  it('reports web when the host is not Capacitor at all', async () => {
    getPlatformMock.mockReturnValue({ kind: 'extension' });
    capacitorPlatform.mockReturnValue('ios');
    expect(await read()).toBe('web');
  });
});
