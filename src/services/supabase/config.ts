/**
 * Supabase project constants — single source of truth.
 *
 * Uses the modern *publishable* key (`sb_publishable_…`), which replaces the
 * deprecated legacy JWT `anon` key. It is safe to ship in the client bundle
 * (same posture the old anon key had): it grants only what RLS / the Edge
 * Function shared-secret gate allow.
 *
 * Edge Function note: publishable keys cannot be sent as `Authorization:
 * Bearer` and only work against functions with `verify_jwt = false`. Our
 * proxies (claude-proxy, google-oauth, gemini-proxy) disable JWT verification
 * and gate on `x-reis-extension-secret`, so callers send this key in the
 * `apikey` header instead.
 */
export const SUPABASE_URL = 'https://zvbpgkmnrqyprtkyxkwn.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QqCe7QTJ6yhYSpRTdBJFSg_Qnt8nBf0';
