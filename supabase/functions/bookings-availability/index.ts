// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// @ts-ignore
const EXTENSION_SECRET = Deno.env.get('EXTENSION_SECRET');

const BASE =
  'https://bookings.cloud.microsoft/BookingsService/api/V1/bookingBusinessesc2/RezervacestudovenMENDELU@mendelu.onmicrosoft.com/';
const TZ = 'Central Europe Standard Time';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-reis-extension-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

let cache: { at: number; payload: unknown } | null = null;
const TTL_MS = 60_000;

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function dateOnly(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00`;
}

// Bound every upstream call so a stalled Bookings request can't hold the edge
// invocation open until the platform kills it.
async function fetchWithTimeout(url: string, opts: RequestInit, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const secretHeader = req.headers.get('x-reis-extension-secret');
    // Fail closed: a missing server secret must reject, never disable auth.
    if (!EXTENSION_SECRET) {
      return json({ error: 'Service unavailable' }, 503);
    }
    if (secretHeader !== EXTENSION_SECRET) {
      return json({ error: 'Unauthorized: invalid extension secret' }, 401);
    }

    if (cache && Date.now() - cache.at < TTL_MS) return json(cache.payload);

    const svcRes = await fetchWithTimeout(`${BASE}services`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (!svcRes.ok) throw new Error(`services HTTP ${svcRes.status}`);
    const svc = await svcRes.json();
    const services = (svc.service || []).filter((s: any) => (s.staffMemberIds || []).length);

    const now = new Date();
    const start = new Date(now.getTime() - 24 * 3600_000);
    // 60 days ahead — MENDELU's Bookings business allows booking up to its
    // maximumAdvance (P60D). MS only reports AVAILABLE within its own policy, so
    // a wider window never over-offers; it just stops throttling advance booking
    // to a few days. Payload stays small (one block-run per open day per room).
    const end = new Date(now.getTime() + 60 * 24 * 3600_000);

    // Every service maps to a staff member (currently a single shared scheduling
    // mailbox), so many services share one GUID. Fetch availability ONCE per
    // unique GUID, not once per service: N identical calls would trip MS's
    // ~4-concurrent throttle and, over a 60-day window (MS latency is variable,
    // seen up to ~8.5s), blow the fetch timeout and drop every room. A generous
    // 15s timeout absorbs a slow-but-valid response instead of aborting it.
    const uniqueGuids = [...new Set<string>(services.map((s: any) => s.staffMemberIds[0]))];
    const availByGuid = new Map<string, unknown[]>();
    await Promise.all(
      uniqueGuids.map(async (guid) => {
        try {
          const availRes = await fetchWithTimeout(
            `${BASE}GetStaffAvailability`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                staffIds: [guid],
                startDateTime: { dateTime: dateOnly(start), timeZone: TZ },
                endDateTime: { dateTime: dateOnly(end), timeZone: TZ },
              }),
            },
            15000
          );
          if (!availRes.ok) return; // leave GUID unset → its rooms omitted, not fabricated
          const availJson = await availRes.json();
          availByGuid.set(guid, availJson.staffAvailabilityResponse?.[0]?.availabilityItems || []);
        } catch {
          // Timeout/network: omit this GUID's rooms so the client shows "unknown"
          // for them rather than "fully booked" for all.
        }
      })
    );

    const rooms = services
      .map((s: any) => {
        const guid = s.staffMemberIds[0];
        const items = availByGuid.get(guid);
        if (!items) return null;
        const lead = s.bookingsSchedulingPolicy?.minimumLeadTime === 'P2D' ? 2880 : 60;
        return { staffGuid: guid, serviceId: s.serviceId, webUrl: s.webUrl, leadMinutes: lead, items };
      })
      .filter((r: unknown) => r !== null);

    const payload = { rooms };
    cache = { at: Date.now(), payload };
    return json(payload);
  } catch (_error) {
    // Never surface upstream error details; the client treats [] as degraded.
    return json({ rooms: [] }, 200);
  }
});
