-- Who is shown a study-aids link under Předměty (2026-11-18), set in the admin
-- console and live without a store release. The first link is mendelu.app.
--
--   study_aids   one row per link: the id that data/studyAids.ts knows, the
--                audience (faculty and programme tokens, the shape a partner's
--                audience has: 'af:B-ATE', 'af', 'mendelu'), and an on/off switch
--
-- Not a society and not a company: no logo, no partner row. The address and the
-- counter label stay in the client, so the privacy guard still sees every host.
-- The device matches the audience itself; nothing about the student goes up.
--
-- Additive and safe for every released build: one new table that no released
-- build references. Nothing existing is changed. Safe to re-run.
-- supabase/tests/study_aids.test.sql checks the behaviour.

create table if not exists public.study_aids (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9_-]*$'),
  -- The same rule a partner's audience follows (societies_audience_valid):
  -- at least one token, each a faculty with an optional programme, or 'mendelu'.
  audience text[] not null check (public.societies_audience_valid(audience)),
  -- Off until the admin switches it on, so a deploy shows nothing by itself.
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.study_aids is
  'Who is shown each study-aids link under Předměty. Read by builds after 5.7.2; written in the admin console.';

alter table public.study_aids enable row level security;

-- Students read only what is switched on; the console (reis_admin) reads everything.
drop policy if exists study_aids_read_active on public.study_aids;
create policy study_aids_read_active on public.study_aids
  for select to anon, authenticated
  using (is_active);

drop policy if exists study_aids_admin_read on public.study_aids;
create policy study_aids_admin_read on public.study_aids
  for select to authenticated using (public.get_my_role() = 'reis_admin');

drop policy if exists study_aids_admin_update on public.study_aids;
create policy study_aids_admin_update on public.study_aids
  for update to authenticated
  using (public.get_my_role() = 'reis_admin')
  with check (public.get_my_role() = 'reis_admin');

-- The schema's default privileges grant every new table to anon; take back what
-- students never need. No insert and no delete for anyone through the API: a
-- link exists because a migration seeded its row and the client knows its id.
revoke insert, update, delete, truncate on public.study_aids from anon;
revoke insert, delete, truncate on public.study_aids from authenticated;

-- mendelu.app, for the programmes of the Ústav techniky a automobilové dopravy
-- that its author named. Switched OFF: the admin turns it on, and can change the
-- programmes there (Technické znalectví a oceňování has no code here yet).
insert into public.study_aids (id, audience, is_active)
values ('mendelu-app', array['af:B-ATE', 'af:N-PTE', 'af:B-ZIN'], false)
on conflict (id) do nothing;
