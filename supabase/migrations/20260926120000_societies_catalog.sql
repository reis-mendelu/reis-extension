-- Societies catalog: who the student societies are, and their logos.
--
-- Until now a society existed only in the client's compiled catalog
-- (src/data/societies.ts + src/services/spolky/config.ts) and its logo shipped
-- in public/spolky/, so adding one was a code change and a store release. This
-- table and the society-logos bucket make it data a reIS admin edits in the
-- admin console. Spec: docs/superpowers/specs/2026-09-26-societies-in-supabase-design.md
--
-- Creates new objects only, apart from ONE contact with existing schema: the
-- foreign key from spolky_accounts.association_id. An old client build against
-- this database is unaffected.
--
-- Dollar quotes carry their own tags (fn, chk) so the whole file can be wrapped
-- in one DO block for the prod dry-run (runbook step 2). Never write that
-- block's tag in this file: a comment containing it ends the wrapper early.
--
-- APPLY BY HAND (no CI applies migrations):
--   npx supabase db query --linked -f supabase/migrations/20260926120000_societies_catalog.sql

begin;

create table public.societies (
  id                  text primary key check (id ~ '^[a-z0-9][a-z0-9_-]*$'),
  name                text not null check (length(btrim(name)) between 1 and 80),
  short_name          text not null check (length(btrim(short_name)) between 1 and 24),
  color               text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  faculty_key         text not null check (faculty_key in ('mendelu','pef','af','ldf','zf','frrms')),
  auto_follow_faculty boolean not null default false,
  audience_label      text check (audience_label in ('erasmus')),
  logo_path           text check (logo_path is null or logo_path ~ ('^' || id || '/[0-9a-f]{32}\.png$')),
  sort_order          integer not null default 0,
  is_active           boolean not null default true,
  updated_at          timestamptz not null default now()
);

-- One default society per faculty: first-run auto-follow picks exactly one.
create unique index societies_one_auto_follow_per_faculty
  on public.societies (faculty_key) where auto_follow_faculty;

-- The id is the society's LOGIN (<id>@societies.invalid) and what RLS matches
-- posts against. Renaming it is a four-table operation
-- (20260915120000_rename_af_society_to_usaf.sql), never an edit here.
create function public.societies_guard() returns trigger
language plpgsql set search_path = public as $fn$
begin
  if new.id <> old.id then
    raise exception 'societies.id is immutable: it is the society login';
  end if;
  new.updated_at := now();
  return new;
end $fn$;

create trigger societies_guard before update on public.societies
  for each row execute function public.societies_guard();

alter table public.societies enable row level security;

-- Supabase's default privileges hand anon full CRUD and TRUNCATE on a new
-- table. Take everything back, then grant only what the policies below use.
revoke all on public.societies from anon, authenticated;
grant select on public.societies to anon, authenticated;
grant insert, update on public.societies to authenticated;

create policy societies_public_read on public.societies
  for select to anon, authenticated using (true);
create policy societies_admin_insert on public.societies
  for insert to authenticated with check (public.get_my_role() = 'reis_admin');
create policy societies_admin_update on public.societies
  for update to authenticated
  using (public.get_my_role() = 'reis_admin')
  with check (public.get_my_role() = 'reis_admin');

-- Today's catalog, verbatim from src/data/societies.ts and spolky/config.ts.
-- logo_path stays null until scripts/seed-society-logos.ts uploads the files.
insert into public.societies
  (id, name, short_name, color, faculty_key, auto_follow_faculty, audience_label, sort_order)
values
  ('esn',      'ESN MENDELU', 'ESN',      '#00AEEF', 'mendelu', false, 'erasmus', 10),
  ('supef',    'SU PEF',      'SUPEF',    '#0046a0', 'pef',     true,  null,      20),
  ('au_frrms', 'AU FRRMS',    'AU FRRMS', '#c32897', 'frrms',   true,  null,      30),
  ('usaf',     'USAF',        'USAF',     '#c87800', 'af',      true,  null,      40),
  ('ldf',      'LDF Spolek',  'LDF',      '#0a5028', 'ldf',     true,  null,      50),
  ('zf',       'ZF Spolek',   'ZF',       '#8c0a00', 'zf',      true,  null,      60),
  ('ey',       'EY',          'EY',       '#2E2E38', 'pef',     false, null,      70),
  ('reis',     'reIS',        'reIS',     '#79be15', 'mendelu', false, null,      80);

-- Every account must name a society that exists. Checked, not assumed:
-- verified 2026-09-26 that prod holds exactly the eight ids above.
do $chk$
declare orphans text;
begin
  select string_agg(a.association_id, ', ') into orphans
    from public.spolky_accounts a
   where not exists (select 1 from public.societies s where s.id = a.association_id);
  if orphans is not null then
    raise exception 'aborting: spolky_accounts rows with no society: %', orphans;
  end if;
end $chk$;

alter table public.spolky_accounts
  add constraint spolky_accounts_association_id_fkey
  foreign key (association_id) references public.societies (id)
  on update restrict on delete restrict;

-- spolky_events deliberately gets NO foreign key: posts outlive accounts
-- (see the USAF migration) and must keep resolving.

-- Logos. Public bucket: <img> reads the public URL, no select policy needed for
-- students. PNG only. An SVG opened directly on the Supabase origin can run script.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('society-logos', 'society-logos', true, 262144, array['image/png'])
on conflict (id) do nothing;

create policy society_logos_admin_select on storage.objects
  for select to authenticated
  using (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');
create policy society_logos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');
create policy society_logos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin')
  with check (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');
create policy society_logos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');

commit;
