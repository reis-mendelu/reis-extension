import { describe, it, expect } from 'vitest';
import { sheetClearancePanPx } from '../mapSheetClearance';

/**
 * Where a focused event's pin goes on a phone, whose sheet covers the bottom
 * of the map.
 *
 * Leaflet centres on its whole container, and the sheet is drawn over that
 * container rather than beside it. Measured at 390×844 before this existed: an
 * Akce-list tap put the pin at y=422 under an event card whose top was at 373.
 * The answer is the middle of the strip the student can actually see, between
 * the search bar and the sheet.
 */
describe('sheetClearancePanPx', () => {
  it('lifts a pin hidden behind the card into the visible strip', () => {
    // Pin 422, search bar bottom 66, sheet top 373 → strip middle 219.5.
    expect(sheetClearancePanPx(422, 66, 373)).toBe(203);
  });

  it('barely moves a pin that the peek band already leaves clear', () => {
    // The calendar's arrival: sheet at peek, top 678. Still re-centred in the
    // strip, so every arrival puts the pin in the same place relative to it.
    expect(sheetClearancePanPx(422, 66, 678)).toBe(50);
  });

  it('pans down, not only up, when the pin is above the strip middle', () => {
    expect(sheetClearancePanPx(100, 66, 678)).toBe(-272);
  });

  it('leaves the camera alone when there is no strip to centre in', () => {
    // A sheet dragged up to the search bar (or a measurement taken before
    // either had laid out): centring in nothing is a guess, not an answer.
    expect(sheetClearancePanPx(422, 66, 66)).toBe(0);
    expect(sheetClearancePanPx(422, 66, 40)).toBe(0);
  });
});
