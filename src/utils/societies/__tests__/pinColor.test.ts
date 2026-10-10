import { describe, it, expect } from 'vitest';
import { isUsablePinColor } from '../pinColor';
import { BUNDLED_SOCIETIES } from '../../../data/societies';

describe('isUsablePinColor', () => {
  it('accepts every colour already in the catalog', () => {
    for (const s of Object.values(BUNDLED_SOCIETIES)) expect(isUsablePinColor(s.color)).toBe(true);
  });
  it('rejects EY yellow and near-white on the light basemap', () => {
    expect(isUsablePinColor('#FFE600')).toBe(false);
    expect(isUsablePinColor('#f5f5f5')).toBe(false);
  });
  it('rejects anything that is not #rrggbb', () => {
    expect(isUsablePinColor('red')).toBe(false);
    expect(isUsablePinColor('#fff')).toBe(false);
  });
});
