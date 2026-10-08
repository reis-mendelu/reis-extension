import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

/** Seen / Opened / Link for one event, each counted once per device. */
export interface EventSignalTotals {
  seen: number;
  opened: number;
  linkTaps: number;
}

const Row = z.object({
  event_id: z.string(),
  seen: z.coerce.number(),
  opened: z.coerce.number(),
  link_taps: z.coerce.number(),
});

/**
 * Totals per event for the admin console's event list (spec 2026-10-08).
 * Scoped server-side: reis_admin reads any event, a society login only its own.
 * Every requested id comes back, zero when nothing was counted; `ok: false`
 * means the read failed, which the caller must not show as zeros. Not for
 * dev:web's in-memory store, whose `dev-N` ids are not the uuids the RPC takes.
 */
export async function fetchEventSignals(
  ids: string[]
): Promise<{ totals: Record<string, EventSignalTotals>; ok: boolean }> {
  const totals: Record<string, EventSignalTotals> = {};
  for (const id of ids) totals[id] = { seen: 0, opened: 0, linkTaps: 0 };
  if (ids.length === 0 || DEV_SOCIETY) return { totals, ok: true };
  // Never rejects: the console calls this detached, so a thrown client error
  // would surface as an unhandled rejection rather than a missing number.
  let data: unknown;
  try {
    const res = await adminAuthClient.rpc('event_signals', { p_event_ids: ids });
    if (res.error) {
      logError('Api.fetchEventSignals', res.error);
      return { totals, ok: false };
    }
    data = res.data;
  } catch (err) {
    logError('Api.fetchEventSignals', err);
    return { totals, ok: false };
  }
  for (const raw of (data ?? []) as unknown[]) {
    const r = Row.safeParse(raw);
    // A malformed row stays at zero rather than becoming NaN on screen.
    if (!r.success) continue;
    totals[r.data.event_id] = {
      seen: r.data.seen,
      opened: r.data.opened,
      linkTaps: r.data.link_taps,
    };
  }
  return { totals, ok: true };
}
