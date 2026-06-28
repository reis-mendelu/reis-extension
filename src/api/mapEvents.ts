import type { MapEvent, FacultyKey, EventCategory } from '../types/events';
import { societyById } from '../data/societies';
import { inferCategory } from '../data/eventCategories';

// MOCK provider — the single seam the real backend replaces. Titles + dates are
// real, taken from the ESN MENDELU / SU PEF / AU FRRMS public calendars; venues
// are inferred from each society's home base (the calendars don't list rooms),
// and recurring annual events are positioned into the current window so the demo
// isn't empty. Coords are [lng, lat] from the bundled map data:
const VENUE = {
  Q: [16.614247, 49.209592] as [number, number], // PEF building Q (id 0)
  FRRMS: [16.614393, 49.218171] as [number, number], // FRRMS / Kolej Akademie
  TAUF: [16.588635, 49.215198] as [number, number], // Tauferovy sports centre
  JAK: [16.630567, 49.216291] as [number, number], // Koleje JAK
  CESKA: [16.606389, 49.198056] as [number, number], // Česká tram stop (Česká/Joštova), city centre — off-campus meet-up point
};

// Off-campus venues that still get a map pin (a real meet-up spot in the city),
// as opposed to on-campus venues. Used to tag venueKind honestly.
const OFFCAMPUS_VENUES = new Set<keyof typeof VENUE>(['CESKA']);

const URLS: Record<string, string> = {
  esn: 'https://www.instagram.com/esnmendelubrno/',
  supef: 'https://www.instagram.com/supefmendelu/',
  au_frrms: 'https://au.mendelu.cz',
};

interface Seed {
  title: string;
  societyId: string;
  date: string; // ISO yyyy-mm-dd
  time: string | null;
  venue: keyof typeof VENUE | null; // null = off-campus, list-only
  room?: string;
  category?: EventCategory; // override; defaults to inferCategory(title)
}

// Local (not UTC) ISO yyyy-mm-dd — avoids the off-by-one toISOString gives near
// midnight in CET. The mock window is anchored to "now" so the demo always shows
// upcoming events no matter when it runs.
function isoLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// `days` from today. The list groups by a rolling 7-day window (see weekSections),
// so 1–2 days out is always "this week" and 7+ days out is always "next week" —
// no calendar-boundary spill, no empty "This week" on weekends.
function inDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return isoLocal(d);
}

// A tight 4-event window — this week + next week — so the panel reads as a short,
// near-term agenda rather than a whole-semester dump. Kept varied on purpose:
// three societies, on- and off-campus, distinct categories/pins.
const SEEDS: Seed[] = [
  // This week (tomorrow + day after — always inside the rolling 7-day window)
  { title: 'Erasmus Cup: Basketball', societyId: 'esn', date: inDays(1), time: '18:00', venue: 'TAUF' },
  { title: 'PEF Kvíz', societyId: 'supef', date: inDays(2), time: '18:00', venue: 'Q', room: 'Q01' },
  // Next week (8 + 10 days out — always in the second window)
  { title: 'Tram Party', societyId: 'esn', date: inDays(8), time: '20:00', venue: 'CESKA' },
  { title: 'Karaoke Night', societyId: 'au_frrms', date: inDays(10), time: '19:00', venue: 'FRRMS' },
];

function toEvent(s: Seed, i: number): MapEvent {
  const soc = societyById(s.societyId);
  const coord = s.venue ? VENUE[s.venue] : null;
  return {
    id: `mock-${i}-${s.date}`,
    title: s.title,
    url: URLS[s.societyId] ?? '',
    date: s.date,
    endDate: null,
    time: s.time,
    location: s.room ?? (s.venue === 'TAUF' ? 'Sportovní centrum' : s.venue === 'JAK' ? 'Koleje JAK' : s.venue === 'FRRMS' ? 'FRRMS' : s.venue === 'CESKA' ? 'Česká (sraz)' : null),
    imageUrl: null,
    organizerKey: soc.facultyKey as FacultyKey,
    societyId: s.societyId,
    coord,
    roomCode: s.room ?? null,
    venueKind: s.venue == null || OFFCAMPUS_VENUES.has(s.venue) ? 'offcampus' : 'campus',
    category: s.category ?? inferCategory(s.title),
  };
}

export const MOCK_MAP_EVENTS: MapEvent[] = SEEDS.map(toEvent);

// Async to mirror the real network seam; returns the static dataset for now.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchMapEvents(_language: string): Promise<MapEvent[]> {
  return MOCK_MAP_EVENTS;
}
