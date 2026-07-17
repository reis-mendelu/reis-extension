// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// @ts-ignore
const EXTENSION_SECRET = Deno.env.get('EXTENSION_SECRET');
// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// @ts-ignore
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// @ts-ignore
const HASH_SALT = Deno.env.get('BOOKING_HASH_SALT') || 'reis-booking';

const BIZ = 'RezervacestudovenMENDELU@mendelu.onmicrosoft.com';
const BASE = `https://bookings.cloud.microsoft/BookingsService/api/V1/bookingBusinessesc2/${BIZ}/`;
const TZ = 'Central Europe Standard Time';
const RATE_LIMIT_PER_HOUR = 5;

// Only these library room (serviceId, staffMemberId) pairs may be booked through
// this proxy — mirrors src/data/map/libraryRooms.ts. The URL is hardcoded to the
// library business, so nothing else is reachable regardless of input.
const ALLOW = new Set(
  [
    ['5c7477a7-4afd-4c5b-bc9f-c157c14b2972', 'e9c87efa-0ea7-4d3e-9f9a-9e51c5775474'],
    ['ff081e72-01eb-4778-a6dc-d5139596cb93', 'ee81403d-0312-49e8-a9cd-bca3be101c32'],
    ['05921bc4-327d-4cc2-b499-3b3ee4603e32', '38efbb39-7a31-4526-bb7e-c34504f1a539'],
    ['e2b362f0-0294-45ff-97e0-1e80ef1e9f51', 'cb31b250-257c-45f5-a79e-957300aea3a6'],
    ['7d0f31df-8b21-42d0-994c-f42d1de78093', '2e10ced2-1057-46c5-a2df-ef90fc1ecdcc'],
    ['c83c7c2c-c1e5-404c-8927-7254015b6930', '548315e4-e230-44ab-b23b-19a643c2d03c'],
    ['31148510-2832-478b-9655-b1a5fd68eb87', 'ee8fec8f-ccf4-4e1c-871d-e0cd725ba90a'],
  ].map(([s, g]) => `${s}|${g}`)
);

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

async function fetchWithTimeout(url: string, opts: RequestInit, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Under the per-student hourly cap? Atomic check-and-log via the RPC. Fails
// closed (treated as over-limit) if the rate-limit backend is misconfigured.
async function underRateLimit(studentHash: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return false;
  try {
    const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/check_and_log_booking`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ p_student_hash: studentHash, p_max: RATE_LIMIT_PER_HOUR }),
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch {
    return false;
  }
}

interface Body {
  serviceId?: string;
  staffMemberId?: string;
  startDateTime?: string;
  endDateTime?: string;
  customer?: { name?: string; email?: string; studentId?: string };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Fail closed: a missing server secret must reject, never disable auth.
    if (!EXTENSION_SECRET) return json({ error: 'unavailable' }, 503);
    if (req.headers.get('x-reis-extension-secret') !== EXTENSION_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const { serviceId, staffMemberId, startDateTime, endDateTime, customer } = body;
    const name = customer?.name?.trim();
    const email = customer?.email?.trim();
    const studentId = customer?.studentId?.trim();

    // Validate shape + allowlist + identity presence.
    if (!serviceId || !staffMemberId || !startDateTime || !endDateTime || !name || !email || !studentId) {
      return json({ error: 'invalid' }, 400);
    }
    if (!ALLOW.has(`${serviceId}|${staffMemberId}`)) return json({ error: 'invalid' }, 400);
    // Weekend guard (defense in depth): the library is closed Sat/Sun.
    const dow = new Date(`${startDateTime}Z`).getUTCDay();
    if (dow === 0 || dow === 6) return json({ error: 'invalid' }, 400);

    // Rate limit per student (hashed, never stored raw).
    const studentHash = await sha256(`${HASH_SALT}:${studentId}`);
    if (!(await underRateLimit(studentHash))) return json({ error: 'rate_limited' }, 429);

    // Discover the service's required custom questions (the library uses one
    // shared "student / employee ID" question, answered with the student's ID).
    const svcRes = await fetchWithTimeout(`${BASE}services`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (!svcRes.ok) return json({ error: 'upstream' }, 502);
    const svcJson = await svcRes.json();
    const service = (svcJson.service || []).find((s: any) => s.serviceId === serviceId);
    const answeredCustomQuestions = ((service?.customQuestions as any[]) || []).map((q) => ({
      customQuestion: {
        id: q.questionGuid,
        questionText: '',
        answerOptions: [],
        answerInputType: 'ANSWER_INPUT_TYPE_TEXT',
      },
      answer: studentId,
      isRequired: q.required ?? true,
      selectedOptions: [],
    }));

    const envelope = {
      appointment: {
        startTime: { dateTime: startDateTime, timeZone: TZ },
        endTime: { dateTime: endDateTime, timeZone: TZ },
        serviceId,
        staffMemberIds: [staffMemberId],
        customers: [
          {
            name,
            emailAddress: email,
            phone: '',
            notes: '',
            timeZone: TZ,
            answeredCustomQuestions,
            location: { displayName: '', address: { street: '', type: 'Other' } },
            smsNotificationsEnabled: false,
            instanceId: '',
            price: 0,
            priceType: 'SERVICEDEFAULTPRICETYPES_NOT_SET',
          },
        ],
        isLocationOnline: false,
        smsNotificationsEnabled: false,
        verificationCode: '',
        customerTimeZone: TZ,
        trackingDataId: '',
        bookingFormInfoList: [],
        price: 0,
        priceType: 'SERVICEDEFAULTPRICETYPES_NOT_SET',
        isAllDay: false,
        additionalRecipients: [],
      },
    };

    const bookRes = await fetchWithTimeout(`${BASE}appointments`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-anchormailbox': BIZ,
        'x-req-source': 'BookingsC2',
        prefer: 'exchange.behavior="IncludeThirdPartyOnlineMeetingProviders"',
      },
      body: JSON.stringify(envelope),
    });

    if (!bookRes.ok) {
      // 4xx from MS is almost always the slot being taken between load and book.
      return json({ error: bookRes.status < 500 ? 'conflict' : 'upstream' }, bookRes.status < 500 ? 409 : 502);
    }
    const created = await bookRes.json().catch(() => ({}));
    const appointmentId =
      created?.appointment?.appointmentId ||
      created?.appointmentId ||
      created?.appointment?.id ||
      created?.id ||
      '';
    if (!appointmentId) return json({ error: 'upstream' }, 502);
    return json({ ok: true, appointmentId });
  } catch (_error) {
    return json({ error: 'upstream' }, 502);
  }
});
