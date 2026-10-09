import { describe, it, expect } from 'vitest';
import { fitWithin, MARK_MAX_W, MARK_MAX_H } from '../encodePartnerMark';

// A partner's mark keeps its aspect (never cropped square like a society logo).
describe('fitWithin', () => {
  it('shrinks a wide logo to the width cap, keeping the aspect', () => {
    expect(fitWithin(1200, 300, MARK_MAX_W, MARK_MAX_H)).toEqual({ w: 480, h: 120 });
  });
  it('shrinks a tall logo to the height cap', () => {
    expect(fitWithin(400, 800, MARK_MAX_W, MARK_MAX_H)).toEqual({ w: 80, h: 160 });
  });
  it('never enlarges', () => {
    expect(fitWithin(100, 40, MARK_MAX_W, MARK_MAX_H)).toEqual({ w: 100, h: 40 });
  });
});
