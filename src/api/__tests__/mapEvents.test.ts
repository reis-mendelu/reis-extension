import { describe, it, expect, vi } from 'vitest';
import { toMapEvent, fetchMapEvents } from '../mapEvents';
import { isPublicEvent } from '../../components/CampusMap/eventWindow';

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
    expect(toMapEvent(row)).toEqual({
      id: 'abc',
      title: 'PEF Kvíz',
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
    expect(toMapEvent(row)).toEqual({
      id: 'def',
      title: 'Tram Party',
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
    });
  });

  it('maps a null coord when either coordinate is missing', () => {
    const row = {
      id: 'ghi',
      association_id: 'af',
      title: 'AF Den',
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
    expect(toMapEvent(row).coord).toBeNull();
  });

  it('isPublicEvent gates past and far-future dates out', () => {
    const now = new Date('2026-07-06T09:00:00');
    expect(isPublicEvent('2026-07-01', now)).toBe(false); // past
    expect(isPublicEvent('2026-07-10', now)).toBe(true); // in window
    expect(isPublicEvent('2026-08-30', now)).toBe(false); // far future
  });
});

vi.mock('../../services/spolky/supabaseClient', () => {
  const iso = (d: number) => {
    const t = new Date();
    t.setDate(t.getDate() + d);
    return t.toISOString().slice(0, 10);
  };
  const mk = (id: string, date: string) => ({
    id,
    association_id: 'supef',
    title: id,
    category: 'party',
    date,
    end_date: null,
    time: null,
    venue_kind: 'offcampus',
    room_code: null,
    coord_lng: 16.6,
    coord_lat: 49.2,
    location: null,
    url: null,
  });
  const rows = [mk('past', iso(-5)), mk('live', iso(3)), mk('future', iso(40))];
  return {
    supabase: {
      from: () => ({
        select: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
      }),
    },
  };
});

describe('fetchMapEvents public window filter', () => {
  it('fetchMapEvents returns only events inside the public window', async () => {
    const events = await fetchMapEvents();
    expect(events.map((e) => e.id)).toEqual(['live']); // past + far-future filtered out
  });
});
