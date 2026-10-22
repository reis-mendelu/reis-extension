import { describe, it, expect, vi, beforeEach } from 'vitest';
import { osOf, platformOf, reportEnvironment } from '../reportEnvironment';

const platform = { kind: 'extension' as 'extension' | 'capacitor' | 'web' };
const capacitor = { name: 'ios' };
vi.mock('@/platform', () => ({ getPlatform: () => platform }));
vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => capacitor.name } }));

describe('osOf', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)', 'iOS 26'],
    ['Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X)', 'iOS 18'],
    ['Mozilla/5.0 (Linux; Android 14; Pixel 8) wv', 'Android 14'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'macOS'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Windows'],
    ['Mozilla/5.0 (X11; Linux x86_64)', 'Linux'],
    ['', 'unknown'],
  ])('%s → %s', (ua, os) => {
    expect(osOf(ua)).toBe(os);
  });
});

describe('platformOf', () => {
  beforeEach(() => {
    platform.kind = 'extension';
    capacitor.name = 'ios';
  });

  it('is the extension in a browser', async () => {
    expect(await platformOf()).toBe('extension');
  });

  it('names the native platform inside the Capacitor shell', async () => {
    platform.kind = 'capacitor';
    expect(await platformOf()).toBe('ios');
    capacitor.name = 'android';
    expect(await platformOf()).toBe('android');
  });

  it('is web for anything else Capacitor reports', async () => {
    platform.kind = 'capacitor';
    capacitor.name = 'web';
    expect(await platformOf()).toBe('web');
  });
});

describe('reportEnvironment', () => {
  it('is the platform and the OS the report was sent from, and nothing else', async () => {
    platform.kind = 'extension';
    const env = await reportEnvironment();
    expect(Object.keys(env).sort()).toEqual(['os', 'platform']);
    expect(env.platform).toBe('extension');
    expect(typeof env.os).toBe('string');
  });
});
