// JSON ciphertext API for the zero-knowledge eduroam transfer.
//
// Supabase rewrites any text/html edge-function response to text/plain+nosniff
// (anti-phishing on the shared *.supabase.co domain), so the install PAGE cannot
// be served here — it lives on a real static host (Vercel). This function is only
// the one-time ciphertext fetch the page calls: GET ?id=<uuid> → { payload } once,
// then the row is burned. It returns CIPHERTEXT only; the AES key never reaches
// this server (it lives solely in the QR fragment, read client-side by the page).
//
// @ts-ignore - Deno types are resolved by the edge runtime, not the repo tsconfig
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// @ts-ignore
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const cors: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

// @ts-ignore - Deno global is provided by the edge runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return json({ error: 'missing id' }, 400);

  // take_eduroam_transfer atomically returns the ciphertext once and burns the row.
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/take_eduroam_transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ p_id: id }),
  });
  if (!r.ok) return json({ error: 'lookup failed' }, 502);

  const payload = await r.json(); // base64 string, or null when missing/expired/used
  if (!payload) return json({ error: 'gone' }, 404);
  return json({ payload });
});
