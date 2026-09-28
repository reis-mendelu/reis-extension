import type { MapEvent, EventCategory, Society } from '../types/events';
import { resolveSociety } from '../utils/societies/resolveSociety';
import { supabase } from '../services/spolky/supabaseClient';
import { logError } from '../utils/reportError';
import { isFinishedEvent, localTodayIso } from '../components/CampusMap/eventWindow';

interface SpolkyEventRow {
  id: string;
  association_id: string;
  title: string;
  category: string;
  date: string;
  end_date: string | null;
  time: string | null;
  venue_kind: string;
  room_code: string | null;
  coord_lng: number | null;
  coord_lat: number | null;
  location: string | null;
  url: string | null;
  body?: string | null;
  subscribers_only?: boolean | null;
}

// Pure row -> MapEvent mapping, kept separate from the network call so it's
// directly unit-testable without hitting Supabase.
export function toMapEvent(row: SpolkyEventRow, societies: Record<string, Society>): MapEvent {
  const soc = resolveSociety(societies, row.association_id);
  const coord: [number, number] | null =
    row.coord_lng != null && row.coord_lat != null ? [row.coord_lng, row.coord_lat] : null;
  return {
    id: row.id,
    title: row.title,
    // '' on every row the old composer wrote, null on older ones: neither is
    // a description, so both read as none.
    description: row.body?.trim() || null,
    url: row.url ?? '',
    date: row.date,
    endDate: row.end_date,
    time: row.time,
    location: row.location,
    imageUrl: null,
    // Unread for map events (the map's faculty filter is gone); display
    // resolves the society reactively through useSociety.
    organizerKey: soc.facultyKey,
    societyId: row.association_id,
    coord,
    roomCode: row.room_code,
    venueKind: row.venue_kind as MapEvent['venueKind'],
    category: row.category as EventCategory,
    // Null on a row written before the column existed, and on anything the
    // select happens not to return: open, which is what those rows have always
    // been. `visibleToStudent` is the only thing that reads this.
    subscribersOnly: row.subscribers_only ?? false,
  };
}

export async function fetchMapEvents(
  societies: Record<string, Society>
): Promise<MapEvent[] | null> {
  // Bounded on the server to events not over yet (a multi-day trip counts until
  // its end date), so a device no longer downloads every past row. No upper
  // bound: the catalog shows the whole semester; pins and Novinky apply their
  // own 14-day horizon (eventWindow.SOON_WINDOW_DAYS).
  const today = localTodayIso();
  const { data, error } = await supabase
    .from('spolky_events')
    .select('*')
    .or(`date.gte.${today},end_date.gte.${today}`)
    .order('date', { ascending: true });

  // null, not []: a failed request must not read as "nothing is on" — the slice
  // keeps the last list (the same rule fetchNotifications follows).
  if (error) {
    logError('Api.fetchMapEvents', error);
    return null;
  }

  return (data ?? [])
    .map((row) => row as SpolkyEventRow)
    .map((row) => toMapEvent(row, societies))
    .filter((e) => !isFinishedEvent(e)); // local day; the server bound is UTC-agnostic but coarse
}
