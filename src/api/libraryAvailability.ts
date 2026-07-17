import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { parseAvailabilityItems, type RawItem } from '@/services/library/nextSlot';
import { logError } from '@/utils/reportError';
import type { RoomAvailability } from '@/types/library';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/bookings-availability`;

export async function fetchLibraryAvailability(): Promise<RoomAvailability[]> {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'x-reis-extension-secret': import.meta.env.VITE_EXTENSION_SECRET || 'reis-secret',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as {
      rooms?: Array<{
        staffGuid: string;
        serviceId: string;
        webUrl: string;
        leadMinutes: number;
        items: RawItem[];
      }>;
    };
    return (data.rooms || []).map((r) => ({
      staffGuid: r.staffGuid,
      serviceId: r.serviceId,
      webUrl: r.webUrl,
      leadMinutes: r.leadMinutes,
      blocks: parseAvailabilityItems(r.items),
    }));
  } catch (err) {
    logError('Api.fetchLibraryAvailability', err);
    return [];
  }
}
