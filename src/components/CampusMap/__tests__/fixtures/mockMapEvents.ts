import type { MapEvent } from '../../../../types/events';

// Test-only fixture standing in for what used to be the exported
// `MOCK_MAP_EVENTS` mock provider in `src/api/mapEvents.ts` (removed in Task 13,
// which replaced the mock with a real Supabase-backed `fetchMapEvents`). Kept
// here — not in production code — purely so CampusMap component/helper tests
// have a small, varied, deterministic set of events to render against: three
// societies, on- and off-campus, distinct categories/pins. Values mirror the
// old mock dataset (same titles/venues/coords) so existing assertions
// (society chip labels, "PEF Kvíz"/"Karaoke Night" text, category emoji) keep
// holding without change.
export const MOCK_MAP_EVENTS: MapEvent[] = [
  {
    id: 'mock-0', title: 'Erasmus Cup: Basketball', url: 'https://www.instagram.com/esnmendelubrno/',
    date: '2026-07-10', endDate: null, time: '18:00', location: 'Sports centre', imageUrl: null,
    organizerKey: 'mendelu', societyId: 'esn', coord: [16.588635, 49.215198], roomCode: null,
    venueKind: 'campus', category: 'sports',
  },
  {
    id: 'mock-1', title: 'PEF Kvíz', url: 'https://www.instagram.com/supefmendelu/',
    date: '2026-07-11', endDate: null, time: '18:00', location: null, imageUrl: null,
    organizerKey: 'pef', societyId: 'supef', coord: [16.614247, 49.209592], roomCode: 'Q01',
    venueKind: 'campus', category: 'quiz',
  },
  {
    id: 'mock-2', title: 'Tram Party', url: 'https://www.instagram.com/esnmendelubrno/',
    date: '2026-07-17', endDate: null, time: '20:00', location: 'Česká (sraz)', imageUrl: null,
    organizerKey: 'mendelu', societyId: 'esn', coord: [16.606389, 49.198056], roomCode: null,
    venueKind: 'offcampus', category: 'party',
  },
  {
    id: 'mock-3', title: 'Karaoke Night', url: 'https://au.mendelu.cz',
    date: '2026-07-19', endDate: null, time: '19:00', location: 'FRRMS', imageUrl: null,
    organizerKey: 'frrms', societyId: 'au_frrms', coord: [16.614393, 49.218171], roomCode: null,
    venueKind: 'campus', category: 'karaoke',
  },
];
