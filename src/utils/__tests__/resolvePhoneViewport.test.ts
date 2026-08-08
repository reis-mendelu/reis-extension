import { describe, it, expect } from 'vitest';
import { resolvePhoneViewport } from '../resolvePhoneViewport';

describe('resolvePhoneViewport', () => {
  it('is a phone when touch and narrow', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: true })).toBe(true);
  });

  it('is not a phone on a narrow desktop window (fine pointer)', () => {
    expect(resolvePhoneViewport({ isTouch: false, isNarrow: true })).toBe(false);
  });

  it('is not a phone on a wide touch screen in a BROWSER (tablet, kiosk)', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: false })).toBe(false);
  });

  /**
   * The native app has no desktop tree to fall back to. An iPad is 834pt wide in
   * portrait, so the width test alone sent it to the desktop layout — which on
   * Capacitor reaches `chrome.runtime.getURL` in PdfViewer and hangs on a
   * spinner forever. The app being native IS the answer to "is this a phone".
   */
  it('is a phone on a WIDE native app screen — an iPad runs the phone UI', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: false, isNativeApp: true })).toBe(true);
  });

  it('is a phone in the native app even without a coarse pointer', () => {
    // A Mac running the iPad build, or a simulator with a trackpad: still the app.
    expect(resolvePhoneViewport({ isTouch: false, isNarrow: false, isNativeApp: true })).toBe(true);
  });

  it('the dev override still wins over the native app', () => {
    expect(
      resolvePhoneViewport({ isTouch: true, isNarrow: false, isNativeApp: true, override: false })
    ).toBe(false);
  });

  it('override true forces the phone branch regardless of viewport', () => {
    expect(resolvePhoneViewport({ isTouch: false, isNarrow: false, override: true })).toBe(true);
  });

  it('override false forces the desktop branch regardless of viewport', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: true, override: false })).toBe(false);
  });

  it('null and undefined override defer to the viewport', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: true, override: null })).toBe(true);
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: true, override: undefined })).toBe(true);
  });
});
