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

    const rooms = (
      await Promise.all(
        services.map(async (s: any) => {
          // Isolate per-room failures: without this try/catch a single room's
          // timeout (fetchWithTimeout aborts → throws) would reject Promise.all
          // and drop ALL rooms to the outer catch. Omit only the failing room so
          // the client renders "unknown" for it, not "fully booked" for all.
          try {
            const guid = s.staffMemberIds[0];
            const lead = s.bookingsSchedulingPolicy?.minimumLeadTime === 'P2D' ? 2880 : 60;
            const availRes = await fetchWithTimeout(`${BASE}GetStaffAvailability`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                staffIds: [guid],
                startDateTime: { dateTime: dateOnly(start), timeZone: TZ },
                endDateTime: { dateTime: dateOnly(end), timeZone: TZ },
              }),
            });
            if (!availRes.ok) return null;
            const availJson = await availRes.json();
            const items = availJson.staffAvailabilityResponse?.[0]?.availabilityItems || [];
            return {
              staffGuid: guid,
              serviceId: s.serviceId,
              webUrl: s.webUrl,
              leadMinutes: lead,
              items,
            };
          } catch {
            return null;
          }
        })
      )
    ).filter((r) => r !== null);

    const payload = { rooms };
    cache = { at: Date.now(), payload };
    return json(payload);
  } catch (_error) {
    // Never surface upstream error details; the client treats [] as degraded.
    return json({ rooms: [] }, 200);
  }
});
