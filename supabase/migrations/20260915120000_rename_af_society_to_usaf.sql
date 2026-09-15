-- Rename the AF society to USAF: 'af' → 'usaf', "AF Spolek" → "USAF".
--
-- The id is not just a label. It is the society's LOGIN — the admin console
-- derives the auth address from it as <id>@societies.invalid (see
-- src/services/admin/societyLogin.ts) — and it is what RLS matches a post's
-- association_id against, via get_my_association(). So the account row, the
-- auth identity and their posts all have to move together or the society is
-- locked out of its own content.
--
-- Everything here is an UPDATE, never a delete + insert: user_id is the FK to
-- auth.users that authorization resolves through, and the password hash lives
-- on that row. The society's password does not change.
--
-- ROLLOUT ORDER MATTERS. Already-released clients resolve society ids from a
-- catalog compiled into the build, so a client older than this rename cannot
-- resolve 'usaf': societyById() falls back to ESN, and a USAF post would be
-- filtered out of an AF-filtered view and misbranded as ESN in an unfiltered
-- one. Nothing in the database can fix a shipped client, so the mitigation is
-- timing — apply this as close to the release as possible. The exposure is
-- bounded: USAF had zero posts when this was written, so only posts published
-- after the rename can be seen wrong, and only by clients that have not yet
-- updated.

begin;

do $$
declare
  v_user_id uuid;
begin
  -- Posts first, and NOT gated on the account existing. spolky_events has no
  -- foreign key to spolky_accounts (verified: the table has none at all), so
  -- deleting an account leaves its posts behind with the old id. Gating this on
  -- the account would strand them under an id that the new catalog resolves to
  -- the wrong society and that no account can manage. Zero rows today; correct
  -- whatever order the two ever happen in.
  update public.spolky_events
     set association_id = 'usaf'
   where association_id = 'af';

  -- Idempotent by design: a re-run, or a branch database that never carried the
  -- old id, is a no-op rather than a failed migration. Reached with the posts
  -- above already renamed, which is what repairs an orphaned set.
  if not exists (select 1 from public.spolky_accounts where association_id = 'af') then
    raise notice 'no society account with association_id ''af'' — posts (if any) renamed, nothing else to do';
    return;
  end if;

  -- Both spellings at once would mean two accounts competing for one society;
  -- merging them is a judgement call, not something to guess inside a migration.
  if exists (select 1 from public.spolky_accounts where association_id = 'usaf') then
    raise exception 'aborting: association_id ''usaf'' already exists alongside ''af''';
  end if;

  select user_id into v_user_id from public.spolky_accounts where association_id = 'af';

  -- 1. The account row, including its copy of the address.
  update public.spolky_accounts
     set association_id   = 'usaf',
         association_name = 'USAF',
         email            = 'usaf@societies.invalid'
   where association_id = 'af';

  -- 2. The login.
  update auth.users
     set email = 'usaf@societies.invalid'
   where id = v_user_id;

  -- 3. auth.identities keeps its OWN copy of the address, and GoTrue resolves a
  --    password grant through it. Updating auth.users alone is exactly the bug
  --    where the new username is rejected at sign-in.
  update auth.identities
     set identity_data = jsonb_set(identity_data, '{email}', '"usaf@societies.invalid"'::jsonb)
   where user_id = v_user_id
     and provider = 'email';

end $$;

commit;
