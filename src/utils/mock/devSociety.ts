import type { PostInput, SpolkyEventRow } from '../../api/societyPosts';

// Dev-only "reIS" test society for the standalone webapp (`npm run dev:web`).
// The society/organizer UI is gated behind a real Supabase login whose session
// lives in chrome.storage — which the dev harness shims in-memory, so it drops
// on every reload. When VITE_DEV_SOCIETY is set, the store seeds an association
// session at boot (see initializeStore) and these CRUD calls run against a local
// in-memory store instead of Supabase (a fake session can't satisfy the RLS
// write policies). Gated on import.meta.env.DEV so `wxt build` dead-code-strips
// the whole thing from the production extension — it can never ship.
//
// NOTE: this module only *type*-imports from api/societyPosts, so it stays a
// leaf (no runtime import cycle with societyPosts, which value-imports this).
export const DEV_SOCIETY: string | false =
  import.meta.env.DEV && import.meta.env.VITE_DEV_SOCIETY
    ? String(import.meta.env.VITE_DEV_SOCIETY)
    : false;

let events: SpolkyEventRow[] = [];
let counter = 0;

function rowFrom(input: PostInput, associationId: string, createdBy: string): SpolkyEventRow {
  return {
    id: `dev-${++counter}`,
    association_id: associationId,
    title: input.title,
    body: input.body ?? null,
    category: input.category,
    date: input.date,
    end_date: input.endDate ?? null,
    time: input.time ?? null,
    venue_kind: input.venueKind,
    room_code: input.roomCode ?? null,
    coord_lng: input.coordLng ?? null,
    coord_lat: input.coordLat ?? null,
    location: input.location ?? null,
    url: input.url ?? null,
    created_by: createdBy,
    visible_from: input.visibleFrom ?? null,
  };
}

// In-memory stand-in for the Supabase `spolky_events` table (resets on reload —
// a clean slate each dev session is fine for a test harness).
export const devSocietyStore = {
  list: (associationId: string): SpolkyEventRow[] =>
    events.filter((e) => e.association_id === associationId),
  create: (input: PostInput, associationId: string, createdBy: string): { id?: string } => {
    const row = rowFrom(input, associationId, createdBy);
    events.push(row);
    return { id: row.id };
  },
  update: (id: string, patch: Partial<SpolkyEventRow>): { error?: string } => {
    events = events.map((e) => (e.id === id ? { ...e, ...patch } : e));
    return {};
  },
  delete: (id: string): { error?: string } => {
    events = events.filter((e) => e.id !== id);
    return {};
  },
  reset: (): void => {
    events = [];
    counter = 0;
  },
};
