import { describe, it, expect, vi } from 'vitest';
import { toMapEvent, fetchMapEvents } from '../mapEvents';
import { isFinishedEvent } from '../../components/CampusMap/eventWindow';
import { BUNDLED_SOCIETIES } from '../../data/societies';
import { supabase } from '../../services/spolky/supabaseClient';

vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { from: vi.fn() },
}));

// Shared row fixture for the catalog-fetch tests below.
const base = {
  id: 'd',
  association_id: 'esn',
  title: 'City Game',
  category: 'culture',
  date: '2026-07-10',
  end_date: null,
  time: '18:00',
  venue_kind: 'offcampus',
  room_code: null,
  coord_lng: 16.6,
  coord_lat: 49.2,
  location: null,
  url: null,
};

describe('toMapEvent — the description', () => {
  it('carries what the society wrote, trimmed', () => {
    expect(toMapEvent({ ...base, body: '  Bring a pen.\n' }, BUNDLED_SOCIETIES).description).toBe(
      'Bring a pen.'
    );
  });
  // Every event before the composer had a description field saved body '' —
  // and older rows null. Neither is a description.
  it('reads an empty or whitespace body as no description', () => {
    expect(toMapEvent({ ...base, body: '' }, BUNDLED_SOCIETIES).description).toBeNull();
    expect(toMapEvent({ ...base, body: '   ' }, BUNDLED_SOCIETIES).description).toBeNull();
    expect(toMapEvent({ ...base, body: null }, BUNDLED_SOCIETIES).description).toBeNull();
  });
});

describe('toMapEvent', () => {
  it('maps a campus-room row into a MapEvent with a resolved building coord', () => {
    const row = {
      id: 'abc',
      association_id: 'supef',
      title: 'PEF Kvíz',
      category: 'quiz',
      date: '2026-07-10',
      end_date: null,
      time: '18:00',
      venue_kind: 'campus',
      room_code: 'Q01',
      coord_lng: 16.614247,
      coord_lat: 49.209592,
      location: null,
      url: null,
    };
    expect(toMapEvent(row, BUNDLED_SOCIETIES)).toEqual({
      id: 'abc',
      title: 'PEF Kvíz',
      description: null,
      url: '',
      date: '2026-07-10',
      endDate: null,
      time: '18:00',
      location: null,
      imageUrl: null,
      organizerKey: 'pef',
      societyId: 'supef',
      coord: [16.614247, 49.209592],
      roomCode: 'Q01',
      venueKind: 'campus',
      category: 'quiz',
      // Absent on the row: a society that did not restrict the event, and
      // every row written before the column existed.
      subscribersOnly: false,
    });
  });

  it('maps an off-campus row with a free-text location and no room code', () => {
    const row = {
      id: 'def',
      association_id: 'esn',
      title: 'Tram Party',
      category: 'party',
      date: '2026-07-17',
      end_date: null,
      time: '20:00',
      venue_kind: 'offcampus',
      room_code: null,
      coord_lng: 16.606389,
      coord_lat: 49.198056,
      location: 'Česká (sraz)',
      url: 'https://www.instagram.com/esnmendelubrno/',
    };
    expect(toMapEvent(row, BUNDLED_SOCIETIES)).toEqual({
      id: 'def',
      title: 'Tram Party',
      description: null,
      url: 'https://www.instagram.com/esnmendelubrno/',
      date: '2026-07-17',
      endDate: null,
      time: '20:00',
      location: 'Česká (sraz)',
      imageUrl: null,
      organizerKey: 'mendelu',
      societyId: 'esn',
      coord: [16.606389, 49.198056],
      roomCode: null,
      venueKind: 'offcampus',
      category: 'party',
      // Absent on the row: a society that did not restrict the event, and
      // every row written before the column existed.
      subscribersOnly: false,
    });
  });

  it('maps a null coord when either coordinate is missing', () => {
    const row = {
      id: 'ghi',
      association_id: 'usaf',
      title: 'USAF Den',
      category: 'culture',
      date: '2026-08-01',
      end_date: null,
      time: null,
      venue_kind: 'offcampus',
      room_code: null,
      coord_lng: null,
      coord_lat: null,
      location: 'TBD',
      url: null,
    };
    expect(toMapEvent(row, BUNDLED_SOCIETIES).coord).toBeNull();
  });

  // The catalog has no upper bound any more (Task 4) — only a finished event is
  // ever excluded, never a merely far-future one.
  it('isFinishedEvent gates past dates out, not far-future ones', () => {
    const now = new Date('2026-07-06T09:00:00');
    expect(isFinishedEvent({ date: '2026-07-01', endDate: null }, now)).toBe(true); // past
    expect(isFinishedEvent({ date: '2026-07-10', endDate: null }, now)).toBe(false); // upcoming
    expect(isFinishedEvent({ date: '2026-08-30', endDate: null }, now)).toBe(false); // far future — no longer excluded
  });
});

describe('toMapEvent — a place-TBA row', () => {
  it('keeps venueKind tba and has no coordinate to pin', () => {
    const e = toMapEvent(
      {
        id: 't1',
        association_id: 'esn',
        title: 'Pub Quiz',
        category: 'quiz',
        date: '2026-10-13',
        end_date: null,
        time: null,
        venue_kind: 'tba',
        room_code: null,
        coord_lng: null,
        coord_lat: null,
        location: null,
        url: null,
      },
      BUNDLED_SOCIETIES
    );
    expect(e.venueKind).toBe('tba');
    expect(e.coord).toBeNull();
  });
});

describe('fetchMapEvents — the catalog', () => {
  it('bounds the query to events not finished yet, and keeps far-future rows', async () => {
    const or = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          ...base,
          id: 'far',
          date: '2099-11-23',
          end_date: '2099-11-29',
          venue_kind: 'tba',
          coord_lng: null,
          coord_lat: null,
          time: null,
        },
      ],
      error: null,
    });
    vi.mocked(supabase.from).mockReturnValue({ select: () => ({ or, order }) } as never);
    const events = await fetchMapEvents(BUNDLED_SOCIETIES);
    expect(or).toHaveBeenCalledWith(
      expect.stringMatching(/^date\.gte\.\d{4}-\d{2}-\d{2},end_date\.gte\.\d{4}-\d{2}-\d{2}$/)
    );
    // Soonest first is part of the catalog contract; the list relies on it.
    expect(order).toHaveBeenCalledWith('date', { ascending: true });
    expect(events?.map((e) => e.id)).toEqual(['far']);
  });

  it('returns null — not [] — when the request fails', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      select: () => ({
        or: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'x' } }) }),
      }),
    } as never);
    expect(await fetchMapEvents(BUNDLED_SOCIETIES)).toBeNull();
  });

  // Replaces the old "public window" assertion: the catalog has no upper
  // bound any more, so a far-future row is kept, but a finished one is still
  // dropped client-side (the server bound is coarse — see fetchMapEvents).
  it('drops finished events and keeps far-future ones', async () => {
    const now = new Date();
    const iso = (d: number) => {
      const t = new Date(now);
      t.setDate(t.getDate() + d);
      return t.toISOString().slice(0, 10);
    };
    const mk = (id: string, date: string) => ({ ...base, id, date });
    const rows = [mk('past', iso(-5)), mk('live', iso(3)), mk('future', iso(400))];
    const or = vi.fn().mockReturnThis();
    const order = vi.fn().mockResolvedValue({ data: rows, error: null });
    vi.mocked(supabase.from).mockReturnValue({ select: () => ({ or, order }) } as never);
    const events = await fetchMapEvents(BUNDLED_SOCIETIES);
    expect(events?.map((e) => e.id)).toEqual(['live', 'future']);
  });
});
