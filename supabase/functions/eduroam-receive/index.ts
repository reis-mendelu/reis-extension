// Direct-install endpoint for the eduroam transfer (UX-first model).
//
// The desktop uploads the (password-protected) .mobileconfig to Supabase via
// put_eduroam_transfer; the QR points straight here. iOS Safari navigates to this
// URL, gets the profile with Content-Type application/x-apple-aspen-config, and
// shows the install prompt directly — no intermediate page, no decrypt step.
//
// This is NOT zero-knowledge: Supabase briefly serves the assembled profile. It is
// acceptable because the .p12 inside is password-protected and that extraction
// password is never uploaded nor embedded — the student types it at install, so an
// intercepted profile is still an unopenable PKCS#12. The row is one-time (burned on
// first GET) and short-lived.
//
// @ts-ignore - Deno types are resolved by the edge runtime, not the repo tsconfig
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// @ts-ignore
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function text(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

// @ts-ignore - Deno global is provided by the edge runtime
Deno.serve(async (req: Request) => {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return text('Missing id. Re-scan the QR code in reIS.', 400);

  // take_eduroam_transfer atomically returns the stored profile once and burns the row.
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/take_eduroam_transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ p_id: id }),
  });
  const b64 = r.ok ? await r.json() : null; // base64 profile, or null when missing/expired/used
  if (!b64) {
    return text('This eduroam profile link was already used or has expired. Generate a fresh QR code in reIS.', 404);
  }

  // base64 → raw bytes, served as an Apple configuration profile so iOS installs it.
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/x-apple-aspen-config',
      'Content-Disposition': 'attachment; filename="eduroam-reis.mobileconfig"',
      'Cache-Control': 'no-store',
    },
  });
});
