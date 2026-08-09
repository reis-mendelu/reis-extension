// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// @ts-ignore
const EXTENSION_SECRET = Deno.env.get('EXTENSION_SECRET');
// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// @ts-ignore
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// An unsalted IP hash is reversible and the IP is personal data, so there is
// never a public or known fallback. A dedicated SUGGESTION_HASH_SALT is
// preferred and wins whenever it is set; absent one we derive a salt from the
// service-role key, which is high-entropy, secret, and already required here.
// That keeps the property that matters: a leaked database (backup, read-only
// access) cannot brute-force the IPs back, because the key it would need is
// not stored in the database. If both are missing we still fail closed.
// Rotating the service-role key harmlessly resets at most one hour of
// rate-limit counters — the salt only has to be stable for the counting window.
// @ts-ignore
const EXPLICIT_SALT = Deno.env.get('SUGGESTION_HASH_SALT');
const HASH_SALT = EXPLICIT_SALT || (SERVICE_ROLE ? `derived:v1:${SERVICE_ROLE}` : '');

const RATE_LIMIT_PER_HOUR = 5;

const TYPES = new Set(['bug', 'idea', 'other']);

// Exactly the AppView union in src/types/app.ts. An unknown screen is a client
// bug or a forged payload; both are 400 rather than something we store.
const SCREENS = new Set([
  'calendar',
  'exams',
  'settings',
  'timeline-demo',
  'subjects',
  'studyPlan',
  'erasmus',
  'iskam-dashboard',
  'map',
]);

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

// Atomic check-and-log via the RPC. Fails closed (treated as over-limit) if the
// rate-limit backend is misconfigured or unreachable.
async function underRateLimit(ipHash: string): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE) return false;
  try {
    const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/rpc/check_and_log_suggestion`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ p_ip_hash: ipHash, p_max: RATE_LIMIT_PER_HOUR }),
    });
    if (!res.ok) return false;
    return (await res.json()) === true;
  } catch {
    return false;
  }
}

interface Body {
  type?: string;
  title?: string;
  body?: string;
  contact?: string;
  screen?: string;
  ext_version?: string;
  browser_name?: string;
  browser_version?: string;
  viewport?: string;
}

function clamp(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Fail closed: a missing server secret (auth) or hash salt (privacy) must
    // reject rather than degrade to a public/known value.
    if (!EXTENSION_SECRET || !HASH_SALT || !SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: 'unavailable' }, 503);
    }
    if (req.headers.get('x-reis-extension-secret') !== EXTENSION_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }

    const raw = (await req.json().catch(() => ({}))) as Body;
    const type = clamp(raw.type, 16);
    const title = clamp(raw.title, 120);
    const body = clamp(raw.body, 2000);
    const screen = clamp(raw.screen, 40);
    const contact = clamp(raw.contact, 120);

    if (!TYPES.has(type) || !title || !body || !SCREENS.has(screen)) {
      return json({ error: 'invalid' }, 400);
    }

    // Rate limit per source IP, hashed and salted — never stored raw.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';
    const ipHash = await sha256(`${HASH_SALT}:${ip}`);
    if (!(await underRateLimit(ipHash))) return json({ error: 'rate_limited' }, 429);

    const res = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/suggestions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
        prefer: 'return=minimal',
      },
      body: JSON.stringify({
        type,
        title,
        body,
        contact: contact || null,
        screen,
        ext_version: clamp(raw.ext_version, 20),
        browser_name: clamp(raw.browser_name, 20),
        browser_version: clamp(raw.browser_version, 10),
        viewport: clamp(raw.viewport, 20),
      }),
    });

    if (!res.ok) return json({ error: 'upstream' }, 500);
    return json({ ok: true });
  } catch {
    return json({ error: 'upstream' }, 500);
  }
});
