import { describe, it, expect, afterEach, vi } from 'vitest';
import { desktopEduroamTarget } from '../desktopEduroamTarget';

function ua(value: string) {
  vi.stubGlobal('navigator', { userAgent: value });
}
afterEach(() => vi.unstubAllGlobals());

describe('desktopEduroamTarget', () => {
  it('names the machine reIS is running on', () => {
    ua('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    expect(desktopEduroamTarget()).toBe('mac');
    ua('Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    expect(desktopEduroamTarget()).toBe('windows');
  });

  // The reason this is not `isMac ? 'mac' : 'windows'`: a Linux student would
  // be handed the geteduroam wizard, which is not their machine's flow at all.
  // Null means "ask" — the drawer keeps its device picker.
  it('answers null for a desktop it has no manual for', () => {
    ua('Mozilla/5.0 (X11; Linux x86_64)');
    expect(desktopEduroamTarget()).toBeNull();
    ua('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)');
    expect(desktopEduroamTarget()).toBeNull();
  });

  // Read at call time, not at module load: a test (and a dev override) has to
  // be able to change the answer after the module is imported.
  it('survives a missing navigator', () => {
    vi.stubGlobal('navigator', undefined);
    expect(desktopEduroamTarget()).toBeNull();
  });
});
