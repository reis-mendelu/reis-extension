// Relay in-app feedback to Discord without shipping the webhook URL.
//
// Why this function exists: the client used to POST straight to a Discord
// webhook whose URL was a compile-time constant, so the URL shipped inside
// every build. The repo is open source and an Android APK on a public listing
// is trivially unzipped, and a Discord webhook accepts unauthenticated POSTs
// from anyone holding it. Rotating the URL was never a fix — the replacement
// ships in the next build exactly as the old one did.
//
// **Be clear about what this does and does not buy.** The shared secret is
// itself in the bundle (`VITE_EXTENSION_SECRET`), so a determined attacker who
// unzips the APK can still call this endpoint. What genuinely changes:
//
//   - The Discord URL never leaves the server, so it cannot be abused directly
//     and forever. Abuse now has to come through here.
//   - Coming through here means it is rate-limited, size-capped and
//     shape-checked — none of which a raw Discord webhook offers.
//   - It can be throttled or switched off server-side, without shipping a new
//     app to a store and waiting days for review.
//
// So the rate limiter below is the real control, not the secret. If abuse ever
// materialises, the next step is a DB-backed limiter (like `report_error_v2`'s)
// rather than a stronger client secret, because there is no such thing.

// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { buildContent } from './content.ts';

// @ts-ignore
const EXTENSION_SECRET = Deno.env.get('EXTENSION_SECRET');
// @ts-ignore
const DISCORD_WEBHOOK_URL = Deno.env.get('DISCORD_WEBHOOK_URL');

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

// Input hygiene: reject absurdly large fields before anything is forwarded.
//
// These caps do NOT keep the assembled message inside Discord's 2000-character
// limit, and it is worth being explicit because an earlier comment here claimed
// they did. They are additive — 1200 + 120 + the diagnostic JSON + the envelope
// reached 2295, which Discord rejects, losing a long report to a 502. A limit on
// the sum cannot be expressed as per-field caps, so it is enforced on the
// assembled string in buildContent, and covered by tests there.
const MAX = { title: 140, message: 1200, contact: 120 };

const TYPES = new Set(['bug', 'idea', 'other']);

/**
 * Per-IP sliding window, in the instance's memory.
 *
 * Deliberately not a database round-trip: this runs on every submission, and a
 * feedback form on a student app sees single-digit traffic in a normal day. An
 * edge instance is recycled and there may be several, so this is a floor on
 * abuse cost rather than a hard guarantee — which is the honest description of
 * what it is, and enough for the thing it protects (a chat channel).
 */
const WINDOW_MS = 60 * 60 * 1000;
const PER_IP_PER_HOUR = 6;
const hits = new Map<string, number[]>();

function underRateLimit(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= PER_IP_PER_HOUR) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  // Bound the map so a stream of distinct IPs cannot grow it without limit.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return true;
}

interface Body {
  type?: string;
  title?: string;
  message?: string;
  contact?: string;
  context?: Record<string, unknown>;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    // Fail closed: without the gate secret or the destination there is nothing
    // safe to do, and answering 200 would tell a student their report was sent.
    if (!EXTENSION_SECRET || !DISCORD_WEBHOOK_URL) return json({ error: 'unavailable' }, 503);
    if (req.headers.get('x-reis-extension-secret') !== EXTENSION_SECRET) {
      return json({ error: 'unauthorized' }, 401);
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      'unknown';
    if (!underRateLimit(ip)) return json({ error: 'rate_limited' }, 429);

    const body = (await req.json().catch(() => ({}))) as Body;
    const type = String(body.type ?? '');
    const title = String(body.title ?? '').trim();
    const message = String(body.message ?? '').trim();
    const contact = String(body.contact ?? '').trim();

    if (!TYPES.has(type) || !title || !message) return json({ error: 'invalid' }, 400);
    if (title.length > MAX.title || message.length > MAX.message || contact.length > MAX.contact) {
      return json({ error: 'too_long' }, 413);
    }

    // The Discord envelope is built HERE, not in the client. Leaving it in the
    // app would mean the bundle still described this channel's wire format, and
    // changing the destination would need a store release.
    const payload = {
      username: 'reIS Feedback Bot',
      avatar_url: 'https://is.mendelu.cz/auth/images/logo_mendelu.png',
      thread_name: `[${type.toUpperCase()}] ${title}`.slice(0, 100),
      // `allowed_mentions: {parse: []}` is not cosmetic: without it a student
      // typing @everyone into the feedback box pings the whole server.
      allowed_mentions: { parse: [] as string[] },
      content: buildContent({ type, contact, message, context: body.context }),
    };

    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) return json({ error: 'upstream' }, 502);
    return json({ ok: true });
  } catch {
    // No error detail to the caller: this handler holds a webhook URL, and an
    // exception message is a common way for one to end up in a response body.
    return json({ error: 'unavailable' }, 500);
  }
});
