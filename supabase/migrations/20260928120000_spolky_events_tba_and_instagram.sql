-- Place not known yet is a first-class state: societies hand over whole-semester
-- lists (title + date) long before they know venues. A 'tba' row has no room and
-- no coordinates; it is list-only on the map until the society adds a place.
-- Spec: docs/superpowers/specs/2026-09-28-society-events-catalog-design.md
alter table public.spolky_events drop constraint if exists spolky_events_venue_kind_check;
alter table public.spolky_events add constraint spolky_events_venue_kind_check
  check (venue_kind = any (array['campus','online','offcampus','tba']));

-- The society's Instagram handle, shown as "Více na Instagramu" on events with
-- no URL of their own. A HANDLE, never a URL: the client builds
-- https://www.instagram.com/<handle>/, so nothing else can be linked from it.
alter table public.societies add column if not exists instagram text
  check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$');
comment on column public.societies.instagram is
  'Instagram handle without @. The client builds the URL; it is never stored.';

notify pgrst, 'reload schema';
