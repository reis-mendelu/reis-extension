// @ts-ignore - Deno is not recognized by the main TS config
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generatePassword, toAuthEmail } from './password.ts';

// @ts-ignore
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
// @ts-ignore
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

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
  if (!SUPABASE_URL || !SERVICE_ROLE) return json({ error: 'misconfigured' }, 500);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const token = authHeader.slice('Bearer '.length);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // getUser(token) VERIFIES the caller's JWT against the Auth server — an
  // unsigned or expired token fails here. Only the verified uid is then used to
  // look the role up in the database. The role is never read from the request
  // body, and no anon/publishable key is needed, so the function runs on the
  // env vars the platform injects by itself.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: 'unauthorized' }, 401);

  const { data: caller } = await admin
    .from('spolky_accounts')
    .select('role')
    .eq('user_id', userData.user.id)
    .eq('is_active', true)
    .maybeSingle();
  if (caller?.role !== 'reis_admin') return json({ error: 'forbidden' }, 403);

  let body: { action?: string; username?: string; associationName?: string };
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
      // Fixed server-side. The client never sends a role, and honouring one from the
      // body would let any admin token — including a stolen one — mint a second
      // persistent administrator. Promotion stays a deliberate database action.
      role: 'association',
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
