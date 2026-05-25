// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Google OAuth token-exchange proxy.
//
// The ONLY purpose of this function is to hold the Google `client_secret`
// server-side so it never ships inside the extension bundle. It stores nothing:
// access/refresh tokens are returned straight to the extension, which persists
// them in chrome.storage.local on the user's own device.
//
// Mirrors the gemini-proxy / claude-proxy pattern (shared-secret gate, CORS).

// @ts-ignore
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
// @ts-ignore
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
// @ts-ignore
const EXTENSION_SECRET = Deno.env.get("EXTENSION_SECRET");

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-reis-extension-secret',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set in Edge Function environment");
    }

    // Shared-secret gate (same as gemini-proxy). NOT the Google secret — just an
    // abuse gate so random callers can't burn our token endpoint quota.
    const secretHeader = req.headers.get("x-reis-extension-secret");
    if (EXTENSION_SECRET && secretHeader !== EXTENSION_SECRET) {
      return json({ error: "Unauthorized: invalid extension secret" }, 401);
    }

    const payload = await req.json();
    const action = payload?.action;

    const params = new URLSearchParams();
    params.set("client_id", GOOGLE_CLIENT_ID);
    params.set("client_secret", GOOGLE_CLIENT_SECRET);

    if (action === "exchange") {
      // First-time consent: auth code -> { access_token, refresh_token }
      const { code, code_verifier, redirect_uri } = payload;
      if (!code || !code_verifier || !redirect_uri) {
        return json({ error: "exchange requires code, code_verifier, redirect_uri" }, 400);
      }
      params.set("grant_type", "authorization_code");
      params.set("code", code);
      params.set("code_verifier", code_verifier);
      params.set("redirect_uri", redirect_uri);
    } else if (action === "refresh") {
      // Background renewal: refresh_token -> { access_token }
      const { refresh_token } = payload;
      if (!refresh_token) {
        return json({ error: "refresh requires refresh_token" }, 400);
      }
      params.set("grant_type", "refresh_token");
      params.set("refresh_token", refresh_token);
    } else {
      return json({ error: "Unknown action. Use 'exchange' or 'refresh'." }, 400);
    }

    const googleRes = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const data = await googleRes.json();
    if (!googleRes.ok) {
      // Surface Google's error (e.g. invalid_grant) to the extension, no secrets leaked.
      return json({ error: data.error || "token_endpoint_error", error_description: data.error_description }, googleRes.status);
    }

    // Pass through only the fields the extension needs. refresh_token is present
    // on `exchange`, absent on `refresh` (Google reuses the existing one).
    return json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      refresh_token: data.refresh_token,
      scope: data.scope,
      token_type: data.token_type,
    });
  } catch (error: any) {
    return json({ error: error.message }, 500);
  }
});
