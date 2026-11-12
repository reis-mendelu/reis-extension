import { describe, it, expect } from 'vitest';
import {
  railPaddingPx,
  railOffsetPx,
  clampRailWidth,
  floorColumnPlacement,
  floorColumnHeightPx,
  railMaxHeight,
  FLOOR_COLUMN_RIGHT_PX,
  RAIL_YIELDS_MIN_HEIGHT,
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

  // A closed rail covers nothing, so there is nothing to compensate for. Missed
  // first time round: the offset read only the viewport and the tree, so an
  // event focused after hiding the rail landed off-centre for a panel that was
  // not there.
  it('does not shift when the rail is closed', () => {
    expect(railOffsetPx(1194, true, RAIL_PX, false)).toBe(0);
    expect(railOffsetPx(1194, true, RAIL_PX, true)).toBe(RAIL_PX / 2);
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

describe('railPaddingPx', () => {
  it('reserves the whole rail, and the gap it floats in', () => {
    // The camera SHIFT takes half the rail (it re-centres behind it); fitting
    // a route has to clear the whole of it, or the destination finishes
    // underneath the panel.
    //
    // Plus the inset: the rail FLOATS at `right-4`, so the band it occupies
    // starts 16px before its own width. Measured in phone landscape — the
    // room pill was clamped to 504 on an 844px map and the rail's left edge
    // was at 488, so it still sat 12px under the panel.
    expect(railPaddingPx(1024, true, 340, true)).toBe(356);
  });

  it('reserves nothing on a phone, whatever the store says the rail is', () => {
    // The bug this exists for: the route fit read the rail width straight off
    // the store, which defaults to open at 340. On a 390px map that is 368px
    // of right padding against a 390px container — wider than the map. Leaflet
    // then has no room left to fit into, returns its maxZoom, and the camera
    // stays exactly where it was: the student gets a "9 min" card and a line
    // running off the screen.
    expect(railPaddingPx(390, true, 340, true)).toBe(0);
    expect(railPaddingPx(767, true, 340, true)).toBe(0);
  });

  it('reserves nothing when the rail is closed', () => {
    expect(railPaddingPx(1024, true, 340, false)).toBe(0);
  });

  it('reserves nothing for the desktop tree, which floats its own panel', () => {
    expect(railPaddingPx(1440, false, 340, true)).toBe(0);
  });

  it('never reserves more than half the map, however wide the rail got', () => {
    // A rail dragged wide on a small tablet must still leave a map to fit into.
    expect(railPaddingPx(800, true, 560, true)).toBeLessThanOrEqual(400);
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

describe('floorColumnHeightPx', () => {
  // p-1 + one 24px btn-xs per row + gap-1 between: Q's eight floors measure
  // 228px in the browser.
  it('matches the column the browser lays out', () => {
    expect(floorColumnHeightPx(8)).toBe(228);
    expect(floorColumnHeightPx(4)).toBe(116);
    expect(floorColumnHeightPx(0)).toBe(0);
  });
});

describe('railMaxHeight', () => {
  // The rail stops at 55vh and the floor column stands 190px off the bottom,
  // so on an iPad in landscape the two share a band of the right edge. The
  // rail stops 12px above the column: 190 + 228 + 12 = 430 for Q.
  it('stops above the floor column on a tablet while a building is open', () => {
    const expected =
      'min(55vh, calc(100% - 5rem - var(--safe-top, 0px) - var(--safe-bottom, 0px) - 430px))';
    expect(railMaxHeight(810, 8)).toBe(expected);
    expect(railMaxHeight(1080, 8)).toBe(expected);
    expect(railMaxHeight(RAIL_YIELDS_MIN_HEIGHT, 8)).toBe(expected);
  });

  // 1080x810, no safe areas: the rail ends at 80 + 300 = 380, the column
  // starts at 810 - 190 - 228 = 392.
  it('leaves the rail room for its list on the shortest iPad geometry', () => {
    const viewport = 768;
    const room = viewport - 80 - (190 + floorColumnHeightPx(8) + 12);
    expect(room).toBeGreaterThanOrEqual(250);
  });

  it('keeps the 55vh cap with no column at the edge', () => {
    expect(railMaxHeight(810, null)).toBe('55vh');
    expect(railMaxHeight(810, 0)).toBe('55vh');
  });

  // A phone turned sideways is wide enough for the rail but under 450px tall.
  // Its layout is deliberately left as it was.
  it('keeps the 55vh cap on a phone in landscape', () => {
    expect(railMaxHeight(390, 8)).toBe('55vh');
    expect(railMaxHeight(RAIL_YIELDS_MIN_HEIGHT - 1, 8)).toBe('55vh');
  });
});

describe('floorColumnPlacement', () => {
  // The iPad app on a Mac runs the phone tree with a mouse, in a window of
  // 1782x919 or so. Under the search bar on the left is where the extension's
  // map already keeps the column, and nothing else on this screen lives there.
  it('stands top-left under the search, at a mouse size, without a touch screen', () => {
    expect(floorColumnPlacement(false)).toEqual({ side: 'left', size: 'sm' });
  });

  // Phone and iPad alike, rail open or not. It used to step to the open rail's
  // left edge on a tablet, which on an iPad 8 stood it in the middle of the map.
  it('keeps every touch screen at the right edge, where the phone has it', () => {
    expect(floorColumnPlacement(true)).toEqual({
      side: 'right',
      rightPx: FLOOR_COLUMN_RIGHT_PX,
      size: 'xs',
    });
  });
});
