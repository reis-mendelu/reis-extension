import { describe, it, expect } from 'vitest';
import {
  railOffsetPx,
  clampRailWidth,
  RAIL_PX,
  RAIL_MIN_PX,
  RAIL_MAX_PX,
  RAIL_MIN_WIDTH,
} from '../mapRail';

describe('railOffsetPx', () => {
  it('shifts the camera by half the rail on a tablet running the phone tree', () => {
    expect(railOffsetPx(834, true)).toBe(RAIL_PX / 2);
    expect(railOffsetPx(1194, true)).toBe(RAIL_PX / 2);
  });

  // The student can drag the rail wider, and the camera has to follow — a
  // fixed offset would leave the pin under a rail they had just enlarged.
  it('follows the live rail width', () => {
    expect(railOffsetPx(1194, true, 500)).toBe(250);
    expect(railOffsetPx(1194, true, 300)).toBe(150);
  });

  // A phone shows the card BELOW the map, so the camera is already centred on
  // what you can see.
  it('does not shift on a phone', () => {
    expect(railOffsetPx(390, true)).toBe(0);
    expect(railOffsetPx(RAIL_MIN_WIDTH - 1, true)).toBe(0);
  });

  // The desktop tree floats a DetailPanel over the map instead of taking a
  // column out of it. MapCanvas is shared by both trees, which is the trap.
  it('does not shift the desktop tree at any width', () => {
    expect(railOffsetPx(1440, false)).toBe(0);
    expect(railOffsetPx(834, false)).toBe(0);
  });
});

describe('clampRailWidth', () => {
  it('keeps a comfortable drag exactly where it was dropped', () => {
    expect(clampRailWidth(420, 1194)).toBe(420);
  });

  // Below this the event card's two RSVP buttons stop sitting side by side.
  it('will not go narrower than the card needs', () => {
    expect(clampRailWidth(120, 1194)).toBe(RAIL_MIN_PX);
  });

  it('will not go wider than a rail', () => {
    expect(clampRailWidth(2000, 1194)).toBe(RAIL_MAX_PX);
  });

  // On a small tablet the absolute cap would swallow most of the map, so the
  // share rule bites first — the map is the point of the screen.
  it('yields to half the screen on a narrow tablet', () => {
    expect(clampRailWidth(2000, 800)).toBe(400);
  });

  // ...but never below the card's minimum, however small the screen claims
  // to be. A NaN from a pointer event that lost its target falls back to the
  // default rather than collapsing the rail to nothing.
  it('survives a hostile viewport and a NaN', () => {
    expect(clampRailWidth(2000, 320)).toBe(RAIL_MIN_PX);
    expect(clampRailWidth(Number.NaN, 1194)).toBe(RAIL_PX);
  });
});
