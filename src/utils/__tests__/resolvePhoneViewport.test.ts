import { describe, it, expect } from 'vitest';
import { resolvePhoneViewport } from '../resolvePhoneViewport';

describe('resolvePhoneViewport', () => {
  it('is a phone when touch and narrow', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: true })).toBe(true);
  });

  it('is not a phone on a narrow desktop window (fine pointer)', () => {
    expect(resolvePhoneViewport({ isTouch: false, isNarrow: true })).toBe(false);
  });

  it('is not a phone on a wide touch screen (tablet, kiosk)', () => {
    expect(resolvePhoneViewport({ isTouch: true, isNarrow: false })).toBe(false);
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
