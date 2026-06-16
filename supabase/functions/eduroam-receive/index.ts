// Phone-side receiver for the zero-knowledge eduroam transfer.
//
// Served over HTTPS (secure context required for Web Crypto). The student scans
// the desktop QR with the stock Camera; iOS opens this page in Safari. The page:
//   1. reads the transfer id from ?id= and the AES key from the URL fragment (#),
//   2. calls take_eduroam_transfer (one-time burn) to fetch the CIPHERTEXT only,
//   3. decrypts locally, and saves the .mobileconfig into Files so the student
//      can tap it → Settings installs the profile.
//
// The decryption key lives ONLY in the fragment and is never sent anywhere:
// the fragment is not transmitted in the take_eduroam_transfer request, and the
// page makes no analytics/logging calls. verify_jwt is false because this is a
// public page Safari loads with no auth header; security rests on the opaque id,
// the one-time burn + short TTL, and the fragment-only key.
//
// @ts-ignore - Deno types are resolved by the edge runtime, not the repo tsconfig
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
// @ts-ignore
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const PAGE = (rpcUrl: string, apiKey: string) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Content-Security-Policy"
  content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src ${SUPABASE_URL};" />
<title>MENDELU eduroam</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 2rem 1.25rem;
         max-width: 32rem; margin-inline: auto; line-height: 1.5; }
  h1 { font-size: 1.4rem; } .muted { opacity: .65; font-size: .9rem; }
  .card { border: 1px solid color-mix(in srgb, currentColor 18%, transparent); border-radius: 14px;
          padding: 1rem 1.1rem; margin: 1rem 0; }
  .btn { display: inline-block; background: #0a84ff; color: #fff; text-decoration: none;
         padding: .8rem 1.2rem; border-radius: 12px; font-weight: 600; }
  ol { padding-inline-start: 1.2rem; } li { margin: .4rem 0; }
  .err { color: #d70015; } .ok { color: #1a7f37; }
  code { background: color-mix(in srgb, currentColor 12%, transparent); padding: .1rem .35rem; border-radius: 6px; }
</style>
</head>
<body>
<h1>MENDELU eduroam</h1>
<p class="muted">Wi-Fi profile for your iPhone / iPad.</p>
<div id="status" class="card">Preparing your profile…</div>
<div id="steps" class="card" hidden>
  <strong>Install it:</strong>
  <ol>
    <li>Tap <b>Download / Save to Files</b> below.</li>
    <li>Open <b>Settings</b> → it shows <b>“Profile Downloaded”</b> near the top (do this within ~8&nbsp;minutes).</li>
    <li>Tap <b>Install</b>, enter your passcode, then the <b>certificate password</b> from reIS.</li>
    <li>Your device joins <code>eduroam</code> automatically.</li>
  </ol>
  <p id="dl"></p>
</div>
<p class="muted">Generated on your computer. The decryption key was only in the QR code — this server only ever stored encrypted bytes.</p>
<script>
(function () {
  var RPC = ${JSON.stringify(rpcUrl)};
  var KEY = ${JSON.stringify(apiKey)};
  var statusEl = document.getElementById('status');
  var stepsEl = document.getElementById('steps');
  var dlEl = document.getElementById('dl');

  function fail(msg) { statusEl.className = 'card err'; statusEl.textContent = msg; }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function b64urlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    s += '='.repeat((4 - (s.length % 4)) % 4);
    return b64ToBytes(s);
  }

  async function run() {
    var params = new URLSearchParams(location.search);
    var id = params.get('id');
    var keyB64 = location.hash.replace(/^#/, '');   // key stays client-side only
    if (!id || !keyB64) { return fail('This link is incomplete. Re-scan the QR code in reIS.'); }

    var res, payloadB64;
    try {
      res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': KEY, 'Authorization': 'Bearer ' + KEY },
        body: JSON.stringify({ p_id: id })
      });
      payloadB64 = await res.json();
    } catch (e) { return fail('Could not reach the server. Check your connection and re-scan.'); }

    if (!res.ok || !payloadB64) {
      return fail('This profile link was already used or has expired. Generate a fresh QR code in reIS.');
    }

    try {
      var payload = b64ToBytes(payloadB64);
      var iv = payload.slice(0, 12);
      var ct = payload.slice(12);
      var key = await crypto.subtle.importKey('raw', b64urlToBytes(keyB64), { name: 'AES-GCM' }, false, ['decrypt']);
      var ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct);
      var blob = new Blob([ptBuf], { type: 'application/x-apple-aspen-config' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'eduroam-reis.mobileconfig';
      a.className = 'btn'; a.textContent = 'Download / Save to Files';
      dlEl.appendChild(a);
      statusEl.className = 'card ok';
      statusEl.textContent = 'Profile decrypted on your device. ✓';
      stepsEl.hidden = false;
    } catch (e) { return fail('Could not decrypt the profile (wrong or corrupted link).'); }
  }
  run();
})();
</script>
</body>
</html>`;

// @ts-ignore - Deno global is provided by the edge runtime
Deno.serve((req: Request) => {
  const rpcUrl = `${SUPABASE_URL}/rest/v1/rpc/take_eduroam_transfer`;
  return new Response(PAGE(rpcUrl, ANON_KEY), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
});
