import { describe, it, expect } from 'vitest';
import { chipOffset } from '../chipPlacement';

const LIB: [number, number] = [16.6152, 49.20996];
const W = 124;
const H = 44;

describe('chipOffset', () => {
  it('sits on its coordinate when no other pin is near', () => {
    expect(chipOffset(LIB, [[16.62, 49.21]], W, H)).toEqual({ x: 0, y: 0 });
  });
  it('steps west of a pin just east of it (Vazbič on building A)', () => {
    expect(chipOffset(LIB, [[16.6155, 49.20996]], W, H)).toEqual({ x: -(W / 2 + 11), y: 0 });
  });
  it('steps below a pin just north of it (screen y grows down)', () => {
    expect(chipOffset(LIB, [[16.6152, 49.2102]], W, H)).toEqual({ x: 0, y: H / 2 + 4 });
  });
  it('is decided on the ground, so it does not depend on zoom or pan at all', () => {
    const a = chipOffset(LIB, [[16.6155, 49.20996]], W, H);
    const b = chipOffset(LIB, [[16.6155, 49.20996]], W, H);
    expect(a).toEqual(b);
  });
});
