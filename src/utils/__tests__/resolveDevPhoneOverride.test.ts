import { describe, it, expect } from 'vitest';
import { resolveDevPhoneOverride } from '../resolveDevPhoneOverride';

describe('resolveDevPhoneOverride', () => {
  it('param "1" pins the phone branch regardless of width', () => {
    expect(resolveDevPhoneOverride({ param: '1', isNarrow: false })).toBe(true);
    expect(resolveDevPhoneOverride({ param: '1', isNarrow: true })).toBe(true);
  });

  it('param "0" pins the desktop branch regardless of width', () => {
    expect(resolveDevPhoneOverride({ param: '0', isNarrow: true })).toBe(false);
    expect(resolveDevPhoneOverride({ param: '0', isNarrow: false })).toBe(false);
  });

  it('follows the viewport when no param is given', () => {
    expect(resolveDevPhoneOverride({ param: null, isNarrow: true })).toBe(true);
    expect(resolveDevPhoneOverride({ param: null, isNarrow: false })).toBe(false);
  });

  it('ignores an unrecognised param value and follows the viewport', () => {
    expect(resolveDevPhoneOverride({ param: 'yes', isNarrow: true })).toBe(true);
    expect(resolveDevPhoneOverride({ param: '', isNarrow: false })).toBe(false);
  });
});
