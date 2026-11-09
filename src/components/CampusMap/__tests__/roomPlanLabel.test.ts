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
    expect(roomPlanLabels(sklubRoom, new Map())).toEqual({ full: 'N1015', short: 'N1015' });
  });

  it('leaves every other room as it was', () => {
    const room = { name: 'Q01', passportNumber: 'BA39P1001', nickname: null };
    expect(roomPlanLabels(room, titles)).toEqual({ full: 'Q01.01', short: 'Q01.01' });
  });
});

describe('venueRoomKey', () => {
  it('is the same for a refetched copy of the same venues, so the plan is not retitled', () => {
    const again = venueRowToPin(SKLUB_VENUE_ROW)!;
    expect(venueRoomKey([again])).toBe(venueRoomKey([sklub]));
  });

  it('does not depend on the order the venues arrive in', () => {
    const other = {
      ...sklub,
      id: 'b',
      title: 'B',
      venue: { ...sklub.venue!, roomCode: 'BA01N1001' },
    };
    expect(venueRoomKey([other, sklub])).toBe(venueRoomKey([sklub, other]));
  });

  it('cannot be faked by a title that looks like the separator', () => {
    const a = { ...sklub, title: 'X\nBA01N1001=Y' };
    const b1 = { ...sklub, title: 'X' };
    const b2 = { ...sklub, id: 'b', title: 'Y', venue: { ...sklub.venue!, roomCode: 'BA01N1001' } };
    expect(venueRoomKey([a])).not.toBe(venueRoomKey([b1, b2]));
  });

  it('changes when a venue is renamed', () => {
    expect(venueRoomKey([{ ...sklub, title: 'Pixie' }])).not.toBe(venueRoomKey([sklub]));
  });
});
