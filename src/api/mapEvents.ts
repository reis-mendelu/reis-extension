import type { MapEvent, EventCategory } from '../types/events';
import { societyById } from '../data/societies';
import { supabase } from '../services/spolky/supabaseClient';
import { logError } from '../utils/reportError';
import { isPublicEvent } from '../components/CampusMap/eventWindow';

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
  subscribers_only?: boolean | null;
}

// Pure row -> MapEvent mapping, kept separate from the network call so it's
// directly unit-testable without hitting Supabase.
export function toMapEvent(row: SpolkyEventRow): MapEvent {
  const soc = societyById(row.association_id);
  const coord: [number, number] | null =
    row.coord_lng != null && row.coord_lat != null ? [row.coord_lng, row.coord_lat] : null;
  return {
    id: row.id,
    title: row.title,
    url: row.url ?? '',
    date: row.date,
    endDate: row.end_date,
    time: row.time,
    location: row.location,
    imageUrl: null,
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

export async function fetchMapEvents(): Promise<MapEvent[]> {
  const { data, error } = await supabase
    .from('spolky_events')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    logError('Api.fetchMapEvents', error);
    return [];
  }

  return (data ?? [])
    .map((row) => row as SpolkyEventRow)
    .filter((row) => isPublicEvent(row.date)) // hide past + far-future from the public map/feed
    .map(toMapEvent);
}
