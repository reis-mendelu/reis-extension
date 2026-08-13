import { describe, it, expect } from 'vitest';
import { toMapEvent } from '../mapEvents';
import { isPublicEvent } from '../../components/CampusMap/eventWindow';

/**
 * A REAL row, copied verbatim from production `spolky_events` on 2026-08-11 via
 * the anon REST endpoint — the same read `fetchMapEvents` performs.
 *
 * Hand-written fixtures drift toward whatever the parser already handles. This
 * one records what Supabase actually returns, including the parts a fresh
 * fixture would not think to include: `created_by` is null because the row
 * predates that column being populated, `body` is null rather than '', and
 * `location` is a full unabridged Photon address.
 */
const PRODUCTION_ROW = {
  id: '5f74debd-8bed-463c-9098-2a18ac5c954a',
  association_id: 'reis',
  title: 'Deskovky - test',
  category: 'boardgames',
  date: '2026-07-08',
  end_date: '2026-07-08',
  time: '20:00',
  venue_kind: 'offcampus',
  room_code: null,
  coord_lng: 16.6097345,
  coord_lat: 49.1958782,
  location:
    'Bar, který neexistuje, 1, Dvořákova, Brno-město, Brno-střed, Brno, okres Brno-město, Jihomoravský kraj, 602 00, Česko',
  url: null,
  created_at: '2026-07-04T09:54:06.094818+00:00',
  updated_at: '2026-07-04T09:54:06.094818+00:00',
  body: null,
  created_by: null,
  view_count: 0,
  click_count: 0,
  visible_from: null,
};

describe('toMapEvent against a real production row', () => {
  it('maps every field the map renders', () => {
    const event = toMapEvent(PRODUCTION_ROW);

    expect(event.id).toBe('5f74debd-8bed-463c-9098-2a18ac5c954a');
    expect(event.title).toBe('Deskovky - test');
    expect(event.societyId).toBe('reis');
    expect(event.category).toBe('boardgames');
    expect(event.venueKind).toBe('offcampus');
    // [lng, lat] — the order the pin layer expects, and easy to flip.
    expect(event.coord).toEqual([16.6097345, 49.1958782]);
    expect(event.roomCode).toBeNull();
    // `url: null` becomes '' so the detail card can render it unguarded.
    expect(event.url).toBe('');
    // 'reis' resolves through the society catalog rather than falling back to
    // ESN, which is what an unknown association_id would silently do.
    expect(event.organizerKey).toBe('mendelu');
  });

  it('hides this row from students — it is in the past', () => {
    // The row is real and still in the table, which is exactly why the student
    // map reads "Žádné akce": the public feed is date-filtered, not empty.
    expect(isPublicEvent(PRODUCTION_ROW.date, new Date('2026-08-11'))).toBe(false);
  });

  it('would show it to students had it been dated inside the window', () => {
    // Same row, moved into the 14-day window — proves the filter is what hides
    // it, not a mapping failure upstream.
    expect(isPublicEvent('2026-08-14', new Date('2026-08-11'))).toBe(true);
  });
});
