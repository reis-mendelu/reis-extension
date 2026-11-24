-- The critical app version (November 2026).
--
-- When IS changes so much that an older reIS build breaks (15 Nov 2026: 5.6.0
-- lost Předměty, 5.7.0 already read the new markup), reIS marks the first
-- version that works as critical. A phone below it shows a closable pop-up
-- with the reason, at most twice, and the same reason on an empty Předměty or
-- Zkoušky (src/utils/criticalUpdate.ts). Ordinary releases never use this.
--
-- The reason is shown as written, in the pop-up and on an empty Předměty or
-- Zkoušky alike, so it names the cause and the fix, not one screen: "IS Mendelu
-- změnil vzhled a starší verze reISu z něj některé údaje nenačtou. Nová verze
-- to opravuje."
--
-- One row or none. It happens about once in five years, so there is no admin
-- form: reIS sets the row with SQL as the database owner, e.g.
--   insert into public.critical_app_version (min_version, reason_cz, reason_en)
--   values ('5.7.0', 'IS Mendelu změnil vzhled…', 'IS Mendelu changed its look…')
--   on conflict (id) do update set min_version = excluded.min_version,
--     reason_cz = excluded.reason_cz, reason_en = excluded.reason_en, set_at = now();
-- and clears it with `delete from public.critical_app_version;`.
--
-- Every app downloads the row anonymously and compares on the device, so the
-- request says nothing about the student, not even their app version.
--
-- Additive and safe for every released build: one new table no released build
-- references. Safe to re-run. supabase/tests/critical_app_version.test.sql
-- checks the behaviour.

create table if not exists public.critical_app_version (
  id smallint primary key default 1 check (id = 1),
  min_version text not null check (min_version ~ '^[0-9]{1,3}\.[0-9]{1,2}\.[0-9]{1,2}$'),
  reason_cz text not null check (length(trim(reason_cz)) between 1 and 300),
  reason_en text not null check (length(trim(reason_en)) between 1 and 300),
  set_at timestamptz not null default now()
);

comment on table public.critical_app_version is
  'The first app version that works after a breaking IS change; phones below it are told why and offered the update. Read by the builds after 5.8.0.';

alter table public.critical_app_version enable row level security;

drop policy if exists critical_app_version_read on public.critical_app_version;
create policy critical_app_version_read on public.critical_app_version
  for select to anon, authenticated
  using (true);

-- No write policy: only the owner (SQL, not the app or the console) sets it.
revoke insert, update, delete, truncate on public.critical_app_version from anon, authenticated;
grant select on public.critical_app_version to anon, authenticated;
