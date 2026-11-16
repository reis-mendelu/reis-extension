import { describe, it, expect } from 'vitest';
import { keptLabels, roomTapIntent } from '../roomTints';

const tints = { 7: { fill: '#16a34a', label: 'Týmová 1' } };

describe('roomTapIntent', () => {
  it('hands a tinted room to the screen that tinted it', () => {
    expect(roomTapIntent(7, tints, false)).toBe('claim');
    expect(roomTapIntent(7, tints, true)).toBe('claim');
  });
  it('ignores any other room while that screen is open, so a stray tap does not close it', () => {
    expect(roomTapIntent(8, tints, true)).toBe('ignore');
  });
  it('selects rooms as before when no screen owns the floor', () => {
    expect(roomTapIntent(8, tints, false)).toBe('select');
    expect(roomTapIntent(8, {}, false)).toBe('select');
  });
});

describe('keptLabels', () => {
  const box = (id: number, x: number, rank: number) => ({ id, x, y: 0, w: 50, h: 12, rank });
  it('keeps the higher-ranked of two touching names and every name that touches none', () => {
    expect([...keptLabels([box(1, 0, 1), box(2, 30, 5), box(3, 200, 0)])].sort()).toEqual([2, 3]);
  });
  it('keeps every name when nothing touches', () => {
    expect(keptLabels([box(1, 0, 1), box(2, 60, 1)]).size).toBe(2);
  });
});
