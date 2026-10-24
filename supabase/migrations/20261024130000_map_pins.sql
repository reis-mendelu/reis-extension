-- Society pins: a society's logo on the student map for a while (Vazbič for a
-- month, 2026-10-24), opening its name, a short description and a link. Shown
-- ON THE MAP ONLY — never in Novinky or the map's Akce list.
--
-- A table of its own, not a new spolky_events kind: builds up to 5.4.1 read
-- spolky_events with no kind filter, and Novinky reads it without one in every
-- build, so a new kind there would surface as an event in both. No released
-- build reads this table. Written by Claude in Supabase (admin = Supabase).
--
-- Additive and safe for every released build (checked v5.1.1 … v5.4.1): one new
-- table no released build references. Nothing existing changes. Safe to re-run.
-- supabase/tests/map_pins.test.sql checks the behaviour.

create table if not exists public.map_pins (
  id uuid primary key default gen_random_uuid(),
  -- Whose logo and name the pin shows.
  association_id text not null references public.societies(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  body text check (body is null or length(body) <= 500),
  url text check (url is null or (url ~ '^https://[^\s]{4,}$' and length(url) <= 500)),
  -- Brno, give or take: a typo'd coordinate cannot drop a pin in the sea.
  coord_lng double precision not null check (coord_lng between 16.4 and 16.8),
  coord_lat double precision not null check (coord_lat between 49.1 and 49.3),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint map_pins_dates_chk check (ends_at >= starts_at)
);

comment on table public.map_pins is
  'A society''s logo on the student map between starts_at and ends_at. Map only: not Novinky, not Akce. Read by builds from 5.5.0 on.';

alter table public.map_pins enable row level security;

-- Students see a pin only while it runs.
drop policy if exists map_pins_read_live on public.map_pins;
create policy map_pins_read_live on public.map_pins
  for select to anon, authenticated
  using (now() >= starts_at and now() < ends_at);

-- The schema's default privileges grant every new table to anon; students only
-- ever read. Rows are written by the database owner (Claude in Supabase).
revoke insert, update, delete, truncate on public.map_pins from anon, authenticated;
grant select on public.map_pins to anon, authenticated;
