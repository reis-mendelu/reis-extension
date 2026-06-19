import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

const WINDOWS_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17 Safari/605.1.15';

async function importAs(ua: string) {
  vi.resetModules();
  vi.stubGlobal('navigator', { userAgent: ua });
  return import('../useEduroamSetup');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('useEduroamSetup platform detection', () => {
  it('detects Windows and defaults the target to windows', async () => {
    const mod = await importAs(WINDOWS_UA);
    expect(mod.isWindows).toBe(true);
    const { result } = renderHook(() => mod.useEduroamSetup());
    expect(result.current.target).toBe('windows');
  });

  it('on macOS, isWindows is false and the target is not windows', async () => {
    const mod = await importAs(MAC_UA);
    expect(mod.isWindows).toBe(false);
    const { result } = renderHook(() => mod.useEduroamSetup());
    expect(result.current.target).not.toBe('windows');
  });
});
