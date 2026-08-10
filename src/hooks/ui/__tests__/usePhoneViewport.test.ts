import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

vi.mock('../../../platform', () => ({ getPlatform: vi.fn(() => ({ kind: 'extension' })) }));

import { getPlatform } from '../../../platform';
import { usePhoneViewport } from '../usePhoneViewport';
import { useAppStore } from '../../../store/useAppStore';

/**
 * `resolvePhoneViewport` is unit-tested on its own. What this file covers is the
 * SEAM the pure function cannot see: that the hook maps
 * `getPlatform().kind === 'capacitor'` onto `isNativeApp`.
 *
 * Worth its own test because a regression there is silent — it does not throw or
 * fail a type check, it just quietly puts an iPad back on the desktop tree, where
 * `PdfViewer` hits `chrome.runtime.getURL` and hangs on a spinner. The visible
 * symptom is a file that never opens, three layers away from the cause.
 */
const setViewport = (isTouch: boolean, isNarrow: boolean) => {
  useAppStore.setState({ isTouch, isNarrow, devPhoneOverride: null });
};

const asCapacitor = () =>
  vi.mocked(getPlatform).mockReturnValue({ kind: 'capacitor' } as ReturnType<typeof getPlatform>);

describe('usePhoneViewport', () => {
  beforeEach(() => {
    vi.mocked(getPlatform).mockReturnValue({ kind: 'extension' } as ReturnType<typeof getPlatform>);
  });

  it('is a phone on a WIDE screen in the native app — the iPad case', () => {
    asCapacitor();
    setViewport(true, false);
    expect(renderHook(() => usePhoneViewport()).result.current).toBe(true);
  });

  it('is NOT a phone on the same wide screen in a browser', () => {
    setViewport(true, false);
    expect(renderHook(() => usePhoneViewport()).result.current).toBe(false);
  });

  it('is a phone on a narrow touch screen in a browser', () => {
    setViewport(true, true);
    expect(renderHook(() => usePhoneViewport()).result.current).toBe(true);
  });

  it('the dev override still beats the native host', () => {
    asCapacitor();
    setViewport(true, false);
    useAppStore.setState({ devPhoneOverride: false });
    expect(renderHook(() => usePhoneViewport()).result.current).toBe(false);
  });
});
