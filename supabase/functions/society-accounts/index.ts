// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generatePassword, toAuthEmail } from './password.ts';

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// @ts-ignore
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
// Set explicitly with `supabase secrets set`: this project's legacy anon key is
// DISABLED, so the caller-scoped client below cannot fall back to it.
// @ts-ignore
const PUBLISHABLE = Deno.env.get('SUPABASE_PUBLISHABLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE || !PUBLISHABLE) return json({ error: 'misconfigured' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'unauthorized' }, 401);

  // The caller's own JWT, so get_my_role() resolves via auth.uid(). The database
  // is the source of truth for who is an admin — this function never trusts a
  // role claim from the request body.
  const asCaller = createClient(SUPABASE_URL, PUBLISHABLE, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: role, error: roleErr } = await asCaller.rpc('get_my_role');
  if (roleErr || role !== 'reis_admin') return json({ error: 'forbidden' }, 403);

  let body: { action?: string; username?: string; associationName?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const { action, username } = body;
  if (!action || !username) return json({ error: 'bad_request' }, 400);

  let email: string;
  try {
    email = toAuthEmail(username);
  } catch {
    return json({ error: 'invalid_username' }, 400);
  }
  const associationId = username.trim().toLowerCase();

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === 'create') {
    const password = generatePassword();
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr || !created?.user) return json({ error: 'create_failed' }, 400);

    // Same call, so the auth user and the account row cannot diverge the way the
    // old two-step console flow allowed. If the insert fails the auth user is
    // removed again rather than left orphaned.
    const { error: rowErr } = await admin.from('spolky_accounts').insert({
      user_id: created.user.id,
      email,
      association_id: associationId,
      association_name: body.associationName ?? username,
      role: body.role === 'reis_admin' ? 'reis_admin' : 'association',
      is_active: true,
    });
    if (rowErr) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: 'create_failed' }, 400);
    }
    return json({ password });
  }

  const { data: account, error: lookupErr } = await admin
    .from('spolky_accounts')
    .select('user_id')
    .eq('association_id', associationId)
    .maybeSingle();
  if (lookupErr || !account) return json({ error: 'not_found' }, 404);

  if (action === 'reset') {
    const password = generatePassword();
    const { error } = await admin.auth.admin.updateUserById(account.user_id, { password });
    if (error) return json({ error: 'reset_failed' }, 400);
    return json({ password });
  }

  if (action === 'deactivate') {
    const { error } = await admin
      .from('spolky_accounts')
      .update({ is_active: false })
      .eq('user_id', account.user_id);
    if (error) return json({ error: 'update_failed' }, 400);
    return json({ ok: true });
  }

  if (action === 'delete') {
    // The spolky_accounts row goes with it via ON DELETE CASCADE.
    const { error } = await admin.auth.admin.deleteUser(account.user_id);
    if (error) return json({ error: 'delete_failed' }, 400);
    return json({ ok: true });
  }

  return json({ error: 'bad_request' }, 400);
});
