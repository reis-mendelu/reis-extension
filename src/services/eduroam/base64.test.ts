import { describe, it, expect } from 'vitest';
import { bytesToBase64 } from './base64';

const enc = (s: string) => new TextEncoder().encode(s);

describe('bytesToBase64', () => {
  it('encodes empty input to empty string', () => {
    expect(bytesToBase64(new Uint8Array())).toBe('');
  });
  it('encodes 3-byte group with no padding', () => {
    expect(bytesToBase64(enc('Man'))).toBe('TWFu');
  });
  it('encodes 2-byte remainder with one pad', () => {
    expect(bytesToBase64(enc('Ma'))).toBe('TWE=');
  });
  it('encodes 1-byte remainder with two pads', () => {
    expect(bytesToBase64(enc('M'))).toBe('TQ==');
  });
  it('handles bytes above 127', () => {
    expect(bytesToBase64(new Uint8Array([0xff, 0xff, 0xff]))).toBe('////');
  });
});
