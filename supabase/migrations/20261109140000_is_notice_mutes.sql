-- IS notices a reIS admin turned off for everyone (November 2026).
--
-- From this release reIS shows the notices on a student's own IS home page
-- ("zásadky": "Nový design UIS", "Kontrola osobních údajů", …) in Novinky under
-- MENDELU. They are read on the student's device from their own IS and never
-- sent anywhere. This table is the one control reIS keeps over them: a list of
-- notice keys an admin muted. Every app downloads the whole list and filters on
-- the device, so the request says nothing about what a student's IS shows them.
--
-- `notice_key` is the client's key (api/isNotices.ts): `zasadka:<IS id>`,
-- `link:<path>` or `title:<title>`. `title` is only for the console's list.
--
-- Additive and safe for every released build: one new table no released build
-- references. Nothing existing changes. Safe to re-run.
-- supabase/tests/is_notice_mutes.test.sql checks the behaviour.

create table if not exists public.is_notice_mutes (
  notice_key text primary key check (length(notice_key) between 1 and 300),
  title text not null check (length(trim(title)) between 1 and 300),
  muted_at timestamptz not null default now()
);

comment on table public.is_notice_mutes is
  'IS home-page notices a reIS admin hid from every student''s Novinky. Read by the builds after 5.6.0.';

alter table public.is_notice_mutes enable row level security;

drop policy if exists is_notice_mutes_read on public.is_notice_mutes;
create policy is_notice_mutes_read on public.is_notice_mutes
  for select to anon, authenticated
  using (true);

drop policy if exists is_notice_mutes_admin_insert on public.is_notice_mutes;
create policy is_notice_mutes_admin_insert on public.is_notice_mutes
  for insert to authenticated
  with check (public.get_my_role() = 'reis_admin');

-- The console's upsert is INSERT … ON CONFLICT DO UPDATE, which needs both.
drop policy if exists is_notice_mutes_admin_update on public.is_notice_mutes;
create policy is_notice_mutes_admin_update on public.is_notice_mutes
  for update to authenticated
  using (public.get_my_role() = 'reis_admin')
  with check (public.get_my_role() = 'reis_admin');

drop policy if exists is_notice_mutes_admin_delete on public.is_notice_mutes;
create policy is_notice_mutes_admin_delete on public.is_notice_mutes
  for delete to authenticated
  using (public.get_my_role() = 'reis_admin');

-- The schema's default privileges grant every new table to anon: take the
-- writes back from it, and leave authenticated only what the policies gate.
revoke insert, update, delete, truncate on public.is_notice_mutes from anon;
revoke truncate on public.is_notice_mutes from authenticated;
grant select on public.is_notice_mutes to anon, authenticated;
grant insert, update, delete on public.is_notice_mutes to authenticated;
