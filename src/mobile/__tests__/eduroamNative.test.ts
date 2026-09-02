import { describe, it, expect, vi, beforeEach } from 'vitest';

// registerPlugin must not touch a real bridge; Capacitor.getPlatform is what
// the target resolver reads.
vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => ({ configure: vi.fn() })),
  Capacitor: { getPlatform: vi.fn(() => 'web') },
}));

vi.mock('../../platform', () => ({
  getPlatform: vi.fn(() => ({ kind: 'web' })),
}));

import { Capacitor } from '@capacitor/core';
import { getPlatform } from '../../platform';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../eduroamNative';

function host(kind: 'extension' | 'capacitor' | 'web', os: 'ios' | 'android' | 'web' = 'web') {
  vi.mocked(getPlatform).mockReturnValue({ kind } as never);
  vi.mocked(Capacitor.getPlatform).mockReturnValue(os);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('canConfigureEduroamNatively', () => {
  it('admits both phone OSes inside the Capacitor app', () => {
    host('capacitor', 'ios');
    expect(canConfigureEduroamNatively('ios')).toBe(true);
    host('capacitor', 'android');
    expect(canConfigureEduroamNatively('android')).toBe(true);
  });

  it('never admits a desktop target, even inside the app', () => {
    host('capacitor', 'ios');
    expect(canConfigureEduroamNatively('mac')).toBe(false);
    expect(canConfigureEduroamNatively('windows')).toBe(false);
  });

  it('keeps the desktop→phone transfer in a browser: a phone target off Capacitor is a QR', () => {
    host('extension');
    expect(canConfigureEduroamNatively('ios')).toBe(false);
    expect(canConfigureEduroamNatively('android')).toBe(false);
    host('web');
    expect(canConfigureEduroamNatively('ios')).toBe(false);
  });
});

describe('nativeEduroamTarget', () => {
  it('reports the OS Capacitor is running on', () => {
    host('capacitor', 'ios');
    expect(nativeEduroamTarget()).toBe('ios');
    host('capacitor', 'android');
    expect(nativeEduroamTarget()).toBe('android');
  });

  it('is null off Capacitor, so callers fall back to the browser guess', () => {
    host('extension', 'ios');
    expect(nativeEduroamTarget()).toBeNull();
    host('web');
    expect(nativeEduroamTarget()).toBeNull();
  });

  it('is null when Capacitor itself says web (the dev shell)', () => {
    host('capacitor', 'web');
    expect(nativeEduroamTarget()).toBeNull();
  });
});
