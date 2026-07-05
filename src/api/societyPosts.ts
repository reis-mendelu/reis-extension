import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';

export type VenueKind = 'campus' | 'online' | 'offcampus';

export interface PostInput {
  title: string;
  body: string;
  category: string; // EventCategory value
  date: string; // YYYY-MM-DD
  endDate?: string | null;
  time?: string | null;
  venueKind: VenueKind;
  roomCode?: string | null;
  coordLng?: number | null;
  coordLat?: number | null;
  location?: string | null;
  url?: string | null;
  visibleFrom?: string | null;
}

export interface SpolkyEventRow {
  id: string;
  association_id: string;
  title: string;
  body: string | null;
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
  created_by: string | null;
  visible_from: string | null;
}

// Pure camelCase → snake_case mapping, unit-testable without the network.
export function toRow(input: PostInput, associationId: string, createdBy: string) {
  return {
    association_id: associationId,
    created_by: createdBy,
    title: input.title,
    body: input.body,
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
    visible_from: input.visibleFrom ?? null,
  };
}

export async function createPost(
  input: PostInput,
  associationId: string,
  createdBy: string
): Promise<{ id?: string; error?: string }> {
  const { data, error } = await adminAuthClient
    .from('spolky_events')
    .insert(toRow(input, associationId, createdBy))
    .select('id')
    .single();
  if (error || !data) {
    logError('Admin.createPost', error);
    return { error: error?.message ?? 'unknown_error' };
  }
  return { id: (data as { id: string }).id };
}

export async function updatePost(
  id: string,
  patch: Partial<Omit<ReturnType<typeof toRow>, 'association_id' | 'created_by'>>
): Promise<{ error?: string }> {
  const { error } = await adminAuthClient.from('spolky_events').update(patch).eq('id', id);
  if (error) {
    logError('Admin.updatePost', error);
    return { error: error.message };
  }
  return {};
}

export async function deletePost(id: string): Promise<{ error?: string }> {
  const { error } = await adminAuthClient.from('spolky_events').delete().eq('id', id);
  if (error) {
    logError('Admin.deletePost', error);
    return { error: error.message };
  }
  return {};
}

export async function listMyPosts(associationId: string): Promise<SpolkyEventRow[]> {
  const { data, error } = await adminAuthClient
    .from('spolky_events')
    .select('*')
    .eq('association_id', associationId)
    .order('date', { ascending: true });
  if (error) {
    logError('Admin.listMyPosts', error);
    return [];
  }
  return (data ?? []) as SpolkyEventRow[];
}
