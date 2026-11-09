import { describe, it, expect } from 'vitest';
import { roomPlanLabels, venueRoomKey } from '../roomPlanLabel';
import { venueRoomTitles } from '../venueSearch';
import { venueRowToPin } from '../../../api/venues';
import { SKLUB_VENUE_ROW } from '../../../test/fixtures/sklubVenueRow';

const sklub = venueRowToPin(SKLUB_VENUE_ROW)!;
const titles = venueRoomTitles([sklub]);
// budova Z's room as the CDN floor plan (rooms-9000001.geojson) carries it
const sklubRoom = { name: 'BZ00N1015', passportNumber: 'BZ00N1015', nickname: null };

describe('roomPlanLabels', () => {
  it('names a venue room by the venue, uncut, on the plan and on hover', () => {
    expect(roomPlanLabels(sklubRoom, titles)).toEqual({
      full: 'S-klub Pixie',
      short: 'S-klub Pixie',
    });
  });

  it('keeps the code before any venues have loaded', () => {
    expect(roomPlanLabels(sklubRoom, new Map()).full).not.toBe('S-klub Pixie');
  });

  it('leaves every other room as it was', () => {
    const room = { name: 'Q01', passportNumber: 'BA39P1001', nickname: null };
    expect(roomPlanLabels(room, titles)).toEqual(roomPlanLabels(room, new Map()));
  });
});

describe('venueRoomKey', () => {
  it('is the same for a refetched copy of the same venues, so the plan is not retitled', () => {
    const again = venueRowToPin(SKLUB_VENUE_ROW)!;
    expect(venueRoomKey([again])).toBe(venueRoomKey([sklub]));
  });

  it('changes when a venue is renamed', () => {
    expect(venueRoomKey([{ ...sklub, title: 'Pixie' }])).not.toBe(venueRoomKey([sklub]));
  });
});
