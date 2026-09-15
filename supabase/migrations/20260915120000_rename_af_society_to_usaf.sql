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

begin;

do $$
declare
  v_user_id uuid;
begin
  -- Idempotent by design: a re-run, or a branch database that never carried the
  -- old id, is a no-op rather than a failed migration.
  if not exists (select 1 from public.spolky_accounts where association_id = 'af') then
    raise notice 'no society with association_id ''af'' — nothing to rename';
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

  -- 4. Their posts. Zero rows at the time of writing, but this column is what
  --    the insert/update/delete policies compare against get_my_association(),
  --    so anything published between now and this shipping would otherwise
  --    become uneditable by its own author.
  update public.spolky_events
     set association_id = 'usaf'
   where association_id = 'af';
end $$;

commit;
