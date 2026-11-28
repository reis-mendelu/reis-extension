-- design lab MENDELU's espresso bar: the second venue on the student map, after
-- S-klub. On the map only (Dominik, 9 November 2026) — Jídelníček offers the
-- S-klub venue by id and nothing else (utils/menuTabs.ts), so this row cannot
-- reach it.
--
-- Sources, checked 2026-11-09:
--   ldf.mendelu.cz/design-lab-mendelu — "Espresso bar: Po – ČT 7.30 – 18,
--   Pá 7.30 – 15", "budova F10", and the bar's own Instagram
--   (cerny_kun_v_cernych_polich).
--   The coordinate is the centre of the building's outline in the app's map
--   data (src/data/map/landmarks.json, id -201).
--
-- No menu, lunch or photos yet. The bar's drinks and prices are published
-- nowhere but its Instagram, which was not readable when this was written, and
-- a price nobody checked does not go on a card. They are added in Supabase (the
-- menu and prices_checked columns) once the bar's menu is in hand; the card
-- shows the menu as soon as the row has one.
--
-- Additive and safe for every released build: two rows, no schema change.
-- Builds up to 5.6.0 do not read venues. They do read societies, hidden rows
-- included, and list only active ones. Safe to re-run. The same data as
-- src/test/fixtures/designLabVenueRow.ts.

-- A venue shows the logo, colour and events of a societies row, and the design
-- lab is none of the existing ones (ldf is SPLDF, the students' society, which
-- does not run it). So it gets its own, hidden: not in the pickers, the follow
-- list or anyone's feed. Without a logo it draws as "dl." on the building's
-- dark grey; a logo is uploaded in the admin console like any society's.
insert into public.societies (id, name, short_name, color, faculty_key, auto_follow_faculty, sort_order, is_active)
values ('designlab', 'design lab MENDELU', 'dl.', '#3f3f46', 'ldf', false, 110, false)
on conflict (id) do nothing;

insert into public.venues (id, association_id, title, kind, place, address, room_code, coord_lng, coord_lat, hours, lunch, menu, photos, url, instagram, prices_checked, sort_order)
values (
  'designlab',
  'designlab',
  'Espresso bar design lab',
  '{"cz":"Espresso bar","en":"Espresso bar"}'::jsonb,
  '{"cz":"Budova F10","en":"Building F10"}'::jsonb,
  '{"cz":"Přízemí design labu MENDELU · terasa","en":"design lab MENDELU ground floor · terrace"}'::jsonb,
  null,
  16.616806,
  49.211755,
  '[{"day":1,"open":"07:30","close":"18:00"},{"day":2,"open":"07:30","close":"18:00"},{"day":3,"open":"07:30","close":"18:00"},{"day":4,"open":"07:30","close":"18:00"},{"day":5,"open":"07:30","close":"15:00"}]'::jsonb,
  null,
  '[]'::jsonb,
  '{}',
  'https://ldf.mendelu.cz/design-lab-mendelu/',
  'cerny_kun_v_cernych_polich',
  null,
  10
)
on conflict (id) do nothing;
