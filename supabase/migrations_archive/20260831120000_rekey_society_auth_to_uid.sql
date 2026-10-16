-- Re-key society/admin authorization from the JWT email string to auth.uid().
--
-- Before: get_my_role() and five RLS policies resolved permissions with
--   WHERE email = (auth.jwt() ->> 'email')
-- and public.spolky_accounts had NO foreign key to auth.users — its `id` is a
-- standalone PK that does not equal the auth uid. Any JWT carrying a matching
-- email string inherited that row's permissions; self-signup being disabled was
-- the only thing preventing it. After this migration, holding an email string
-- grants nothing.

begin;

-- 1. The six society accounts are unused and their mailboxes never existed.
--    They are re-created through the admin UI with synthetic addresses; their
--    auth.users rows are deleted separately via the dashboard/admin API.
delete from public.spolky_accounts
 where association_id in ('af', 'au_frrms', 'esn', 'ldf', 'supef', 'zf');

-- 2. Real identity, backfilled from the surviving email pairing.
alter table public.spolky_accounts
  add column if not exists user_id uuid references auth.users (id) on delete cascade;

update public.spolky_accounts sa
   set user_id = u.id
  from auth.users u
 where lower(trim(u.email)) = lower(trim(sa.email))
   and sa.user_id is null;

-- 3. Abort rather than leave an account that can never authorize.
do $$
declare orphans int;
begin
  select count(*) into orphans from public.spolky_accounts where user_id is null;
  if orphans > 0 then
    raise exception 'aborting: % spolky_accounts row(s) have no matching auth.users row', orphans;
  end if;
end $$;

alter table public.spolky_accounts
  alter column user_id set not null,
  add constraint spolky_accounts_user_id_key unique (user_id);

-- 4. Role and association resolve by uid. SECURITY DEFINER avoids RLS recursion;
--    the pinned search_path stops a caller-supplied path resolving these names
--    to something else.
create or replace function public.get_my_role()
returns text language sql stable security definer
set search_path = public
as $$
  select role from public.spolky_accounts
   where user_id = auth.uid() and is_active = true
   limit 1;
$$;

create or replace function public.get_my_association()
returns text language sql stable security definer
set search_path = public
as $$
  select association_id from public.spolky_accounts
   where user_id = auth.uid() and is_active = true
   limit 1;
$$;

grant execute on function public.get_my_role() to authenticated;
grant execute on function public.get_my_association() to authenticated;

-- 5. Policies re-pointed at auth.uid().
-- Redundant: auth_read_spolky_accounts is a strict superset of this one.
drop policy if exists "Users read own account" on public.spolky_accounts;

drop policy if exists "auth_read_spolky_accounts" on public.spolky_accounts;
create policy "auth_read_spolky_accounts"
  on public.spolky_accounts for select to authenticated
  using (user_id = auth.uid() or public.get_my_role() = 'reis_admin');

drop policy if exists "auth_delete_spolky_events" on public.spolky_events;
create policy "auth_delete_spolky_events"
  on public.spolky_events for delete to authenticated
  using (
    association_id = public.get_my_association()
    or public.get_my_role() = 'reis_admin'
  );

drop policy if exists "auth_insert_spolky_events" on public.spolky_events;
create policy "auth_insert_spolky_events"
  on public.spolky_events for insert to authenticated
  with check (
    association_id = public.get_my_association()
    or public.get_my_role() = 'reis_admin'
  );

drop policy if exists "auth_update_spolky_events" on public.spolky_events;
create policy "auth_update_spolky_events"
  on public.spolky_events for update to authenticated
  using (
    association_id = public.get_my_association()
    or public.get_my_role() = 'reis_admin'
  )
  with check (
    association_id = public.get_my_association()
    or public.get_my_role() = 'reis_admin'
  );

commit;
