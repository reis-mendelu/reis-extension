import type { MapEvent, FacultyKey } from '../types/events';
import { societyById } from '../data/societies';

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
};

const URLS: Record<string, string> = {
  esn: 'https://esn.mendelu.cz',
  supef: 'https://supef.cz',
  au_frrms: 'https://au.mendelu.cz',
};

interface Seed {
  title: string;
  societyId: string;
  date: string; // ISO yyyy-mm-dd
  time: string | null;
  venue: keyof typeof VENUE | null; // null = off-campus, list-only
  room?: string;
}

// Soonest-first ordering is applied by the consumer; authoring order here is free.
const SEEDS: Seed[] = [
  // ESN MENDELU — sport at the Tauferovy sports centre, socials at JAK dorms,
  // trips / city parties off-campus.
  { title: 'Country Presentation', societyId: 'esn', date: '2026-09-03', time: '17:00', venue: 'Q', room: 'Q01' },
  { title: 'BU Karaoke', societyId: 'esn', date: '2026-10-05', time: '20:00', venue: 'JAK' },
  { title: 'Beerpong', societyId: 'esn', date: '2026-10-08', time: '19:00', venue: 'JAK' },
  { title: 'Trip to Ostrava', societyId: 'esn', date: '2026-10-10', time: '07:30', venue: null },
  { title: 'Erasmus Cup: Basketball', societyId: 'esn', date: '2026-10-13', time: '18:00', venue: 'TAUF' },
  { title: 'Tram Party', societyId: 'esn', date: '2026-10-22', time: '20:00', venue: null },
  { title: 'Erasmus Cup: Volleyball', societyId: 'esn', date: '2026-10-27', time: '18:00', venue: 'TAUF' },
  { title: 'International Student Ball', societyId: 'esn', date: '2026-11-19', time: '19:00', venue: null },
  // SU PEF — in the PEF/Q building; pub crawl + escape room off-campus.
  { title: 'Filmový klubík', societyId: 'supef', date: '2026-10-14', time: '19:00', venue: 'Q', room: 'Q01' },
  { title: 'PEF Kvíz', societyId: 'supef', date: '2026-10-21', time: '18:00', venue: 'Q', room: 'Q01' },
  { title: 'Tour de Pub', societyId: 'supef', date: '2026-10-28', time: '19:00', venue: null },
  { title: 'Deskovky', societyId: 'supef', date: '2026-11-04', time: '17:00', venue: 'Q', room: 'Q23' },
  { title: 'Beer Pong', societyId: 'supef', date: '2026-11-11', time: '19:00', venue: 'Q', room: 'Q01' },
  { title: 'TINDELU', societyId: 'supef', date: '2026-11-25', time: '20:00', venue: 'Q', room: 'Q01' },
  { title: 'Únikovka', societyId: 'supef', date: '2026-12-02', time: '18:00', venue: null },
  // AU FRRMS — all at the FRRMS building.
  { title: 'Akademické středy — ASY-Quiz', societyId: 'au_frrms', date: '2026-11-05', time: '18:00', venue: 'FRRMS' },
  { title: 'Půlení semestru — NEON Party', societyId: 'au_frrms', date: '2026-11-11', time: '20:00', venue: 'FRRMS' },
  { title: 'Tématické dny — Taiwanský den', societyId: 'au_frrms', date: '2026-11-12', time: '12:00', venue: 'FRRMS' },
  { title: 'Deskovky', societyId: 'au_frrms', date: '2026-11-19', time: '17:00', venue: 'FRRMS' },
  { title: 'Karaoke Night', societyId: 'au_frrms', date: '2026-11-26', time: '19:00', venue: 'FRRMS' },
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
    location: s.room ?? (s.venue === 'TAUF' ? 'Sportovní centrum' : s.venue === 'JAK' ? 'Koleje JAK' : s.venue === 'FRRMS' ? 'FRRMS' : null),
    imageUrl: null,
    organizerKey: soc.facultyKey as FacultyKey,
    societyId: s.societyId,
    coord,
    roomCode: s.room ?? null,
    venueKind: s.venue ? 'campus' : 'offcampus',
  };
}

export const MOCK_MAP_EVENTS: MapEvent[] = SEEDS.map(toEvent);

// Async to mirror the real network seam; returns the static dataset for now.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fetchMapEvents(_language: string): Promise<MapEvent[]> {
  return MOCK_MAP_EVENTS;
}
