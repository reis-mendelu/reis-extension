-- Venues: a permanent place a society runs (S-klub Pixie's café in budova Z
-- first), on the student map with its hours, lunch offer, menu and photos.
-- Decided 2026-11-01: venue data is always entered by reIS, here in Supabase,
-- never through a venue login — so a closure, a price or the week's lunch
-- reaches students without a store release.
--
-- Not a map_pins row: a pin ends, a venue does not, and a pin has nowhere for
-- hours or a menu. Not a column on societies: the admin console writes that
-- table, and a venue is written by Claude in Supabase.
--
-- Additive and safe for every released build (checked v5.1.1 … v5.6.0): one
-- new table and one new public bucket that no released build references.
-- Nothing existing changes. Safe to re-run. supabase/tests/venues.test.sql
-- checks the behaviour.

create table if not exists public.venues (
  -- A slug: 'sklub'. The app's pin id is 'venue:' || id.
  id text primary key check (id ~ '^[a-z0-9-]{2,40}$'),
  -- Whose logo, colour and events the venue shows.
  association_id text not null references public.societies(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 80),
  -- {"cz": …, "en": …}: 'Kavárna', 'Budova Z', 'Přízemí FRRMS · tř. Generála Píky 7'.
  kind jsonb not null check (jsonb_typeof(kind) = 'object' and kind ? 'cz'),
  place jsonb not null check (jsonb_typeof(place) = 'object' and place ? 'cz'),
  address jsonb not null check (jsonb_typeof(address) = 'object' and address ? 'cz'),
  -- The IS room it is in (BZ00N1015), for the map's room label and search.
  room_code text check (room_code is null or room_code ~ '^[A-Z0-9]{4,16}$'),
  -- Brno, give or take, as map_pins.
  coord_lng double precision not null check (coord_lng between 16.4 and 16.8),
  coord_lat double precision not null check (coord_lat between 49.1 and 49.3),
  -- [{"day": 1..7 (ISO, Monday = 1), "open": "HH:MM", "close": "HH:MM"}], Prague time.
  hours jsonb not null default '[]'::jsonb check (jsonb_typeof(hours) = 'array'),
  -- A dated closure, Prague calendar days, inclusive. It wins over the hours,
  -- and the card announces it a week ahead.
  closed_from date,
  closed_until date,
  -- {"name": {cz, en}, "note": {cz, en} | null, "price": 189}: the standing offer.
  lunch jsonb check (lunch is null or jsonb_typeof(lunch) = 'object'),
  -- {"days": [{"date": "YYYY-MM-DD", "soup": "…", "dishes": ["A) …", …]}]}:
  -- the week's dishes as the venue publishes them, filled in weekly by reIS.
  lunch_week jsonb check (lunch_week is null or jsonb_typeof(lunch_week) = 'object'),
  -- [{"id", "title": {cz, en}, "photo": "<venue-photos path>" | null,
  --   "items": [{"name", "price": 89 | "45/55"}]}]
  menu jsonb not null default '[]'::jsonb check (jsonb_typeof(menu) = 'array'),
  -- Paths in the venue-photos bucket, in order. Paths, never URLs: the app
  -- loads images from Supabase Storage only.
  photos text[] not null default '{}',
  url text check (url is null or (url ~ '^https://[^\s]{4,}$' and length(url) <= 500)),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  -- When the menu prices were last checked against the venue's own site; the
  -- card says so, because copied prices go stale.
  prices_checked date,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_closure_chk check (
    (closed_from is null and closed_until is null)
    or (closed_from is not null and closed_until is not null and closed_until >= closed_from)
  )
);

comment on table public.venues is
  'A permanent place a society runs (S-klub''s café), on the student map with hours, lunch, menu and photos. Written by reIS in Supabase. Read by builds after 5.6.0.';

alter table public.venues enable row level security;

drop policy if exists venues_read_active on public.venues;
create policy venues_read_active on public.venues
  for select to anon, authenticated
  using (is_active);

-- The schema's default privileges grant every new table to anon; students only
-- ever read. Rows are written by the database owner (Claude in Supabase).
revoke insert, update, delete, truncate on public.venues from anon, authenticated;
grant select on public.venues to anon, authenticated;

-- Photos: a public bucket, as society-logos. JPEG or WebP, 512 KB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('venue-photos', 'venue-photos', true, 524288, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists venue_photos_admin_insert on storage.objects;
create policy venue_photos_admin_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'venue-photos' and public.get_my_role() = 'reis_admin');
drop policy if exists venue_photos_admin_update on storage.objects;
create policy venue_photos_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'venue-photos' and public.get_my_role() = 'reis_admin')
  with check (bucket_id = 'venue-photos' and public.get_my_role() = 'reis_admin');
drop policy if exists venue_photos_admin_delete on storage.objects;
create policy venue_photos_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'venue-photos' and public.get_my_role() = 'reis_admin');

-- S-klub Pixie, so the café is on the map the day this release ships. Menu,
-- prices, hours and the lunch offer from sklubpixie.cz, checked 2026-11-08
-- (the same data as src/test/fixtures/sklubVenueRow.ts). Later changes are
-- made in Supabase, not here.
insert into public.venues (id, association_id, title, kind, place, address, room_code, coord_lng, coord_lat, hours, lunch, menu, photos, url, instagram, prices_checked, sort_order)
values (
  'sklub',
  'sklub',
  'S-klub Pixie',
  '{"cz":"Kavárna","en":"Café"}'::jsonb,
  '{"cz":"Budova Z","en":"Building Z"}'::jsonb,
  '{"cz":"Přízemí FRRMS · tř. Generála Píky 7","en":"FRRMS ground floor · tř. Generála Píky 7"}'::jsonb,
  'BZ00N1015',
  16.614393,
  49.218171,
  '[{"day":1,"open":"08:00","close":"18:00"},{"day":2,"open":"08:00","close":"18:00"},{"day":3,"open":"08:00","close":"18:00"},{"day":4,"open":"08:00","close":"18:00"},{"day":5,"open":"08:00","close":"18:00"}]'::jsonb,
  '{"name":{"cz":"Denní menu s polévkou","en":"Daily menu with soup"},"note":{"cz":"ve vitríně bagety, croissanty, saláty, sladké","en":"in the display case: baguettes, croissants, salads, sweets"},"price":189}'::jsonb,
  '[
  {
    "id": "coffee",
    "title": {
      "cz": "Káva",
      "en": "Coffee"
    },
    "photo": "sklub/kava.jpg",
    "items": [
      {
        "name": "Espresso",
        "price": 35
      },
      {
        "name": "Espresso Lungo",
        "price": 35
      },
      {
        "name": "Lungo s mlékem",
        "price": 35
      },
      {
        "name": "Cappuccino",
        "price": 55
      },
      {
        "name": "Caffè Latte",
        "price": 55
      },
      {
        "name": "Flat White",
        "price": 65
      },
      {
        "name": "Cold Brew",
        "price": 65
      },
      {
        "name": "Čaj",
        "price": 45
      },
      {
        "name": "Horká čokoláda",
        "price": 65
      }
    ]
  },
  {
    "id": "matcha",
    "title": {
      "cz": "Matcha",
      "en": "Matcha"
    },
    "photo": null,
    "items": [
      {
        "name": "Matcha Latte",
        "price": 89
      },
      {
        "name": "Coconut Matcha",
        "price": 119
      },
      {
        "name": "Mango Matcha",
        "price": 119
      },
      {
        "name": "Strawberry Matcha",
        "price": 119
      },
      {
        "name": "Matcha Red Bull",
        "price": 139
      }
    ]
  },
  {
    "id": "bubble",
    "title": {
      "cz": "Bubble tea",
      "en": "Bubble tea"
    },
    "photo": "sklub/bubble-tea.jpg",
    "items": [
      {
        "name": "Malina + citron",
        "price": 119
      },
      {
        "name": "Jablko + kiwi",
        "price": 119
      },
      {
        "name": "Liči + citron",
        "price": 119
      },
      {
        "name": "Broskev + med",
        "price": 119
      },
      {
        "name": "Dračí ovoce + liči",
        "price": 119
      }
    ]
  },
  {
    "id": "lemonade",
    "title": {
      "cz": "Limonády",
      "en": "Lemonades"
    },
    "photo": null,
    "items": [
      {
        "name": "Mango Fever",
        "price": 89
      },
      {
        "name": "Pink Garden",
        "price": 89
      },
      {
        "name": "Strawberry Breeze",
        "price": 89
      }
    ]
  },
  {
    "id": "soft",
    "title": {
      "cz": "Nealko",
      "en": "Soft drinks"
    },
    "photo": null,
    "items": [
      {
        "name": "Coca-Cola",
        "price": 30
      },
      {
        "name": "Coca-Cola Zero",
        "price": 30
      },
      {
        "name": "Fanta",
        "price": 30
      },
      {
        "name": "Sprite",
        "price": 30
      },
      {
        "name": "Tonic",
        "price": 30
      },
      {
        "name": "Voda neperlivá",
        "price": 30
      },
      {
        "name": "Voda perlivá",
        "price": 30
      },
      {
        "name": "Red Bull",
        "price": 49
      },
      {
        "name": "Nealkoholické pivo",
        "price": 89
      }
    ]
  },
  {
    "id": "beer",
    "title": {
      "cz": "Pivo",
      "en": "Beer"
    },
    "photo": null,
    "items": [
      {
        "name": "Pivo 11°",
        "price": "45/55"
      },
      {
        "name": "Pivo Tchýně",
        "price": "45/55"
      },
      {
        "name": "Pivo Tchýně nealko pomelo",
        "price": 55
      },
      {
        "name": "Plzeň 0,3 plech",
        "price": 55
      }
    ]
  },
  {
    "id": "cocktails",
    "title": {
      "cz": "Koktejly",
      "en": "Cocktails"
    },
    "photo": null,
    "items": [
      {
        "name": "Aperol Spritz",
        "price": 99
      },
      {
        "name": "Campari Soda",
        "price": 99
      },
      {
        "name": "Gin & Tonic",
        "price": 99
      },
      {
        "name": "Hugo Spritz",
        "price": 99
      },
      {
        "name": "Limoncello Spritz",
        "price": 99
      },
      {
        "name": "Mojito",
        "price": 99
      },
      {
        "name": "Prosecco soda jahoda",
        "price": 99
      },
      {
        "name": "Cuba Libre",
        "price": 109
      },
      {
        "name": "Paloma",
        "price": 119
      },
      {
        "name": "Peach Spritz",
        "price": 119
      },
      {
        "name": "Skinny Bitch",
        "price": 119
      },
      {
        "name": "Skinny Bitch Grep",
        "price": 129
      },
      {
        "name": "Skinny Bitch Mango",
        "price": 129
      },
      {
        "name": "Jägerbomb",
        "price": 139
      },
      {
        "name": "Křídla",
        "price": 139
      },
      {
        "name": "Sex on the Beach",
        "price": 139
      }
    ]
  },
  {
    "id": "shots",
    "title": {
      "cz": "Panáky",
      "en": "Shots"
    },
    "photo": null,
    "items": [
      {
        "name": "Zelená",
        "price": 45
      },
      {
        "name": "Modrá",
        "price": 45
      },
      {
        "name": "Broskvová vodka",
        "price": 60
      },
      {
        "name": "Jelzin dle nabídky",
        "price": 60
      },
      {
        "name": "Ořechovice",
        "price": 60
      },
      {
        "name": "Vaječňák",
        "price": 60
      },
      {
        "name": "Absolut Vodka",
        "price": 80
      },
      {
        "name": "Bacardí",
        "price": 80
      },
      {
        "name": "Gin",
        "price": 80
      },
      {
        "name": "Grant''s",
        "price": 80
      },
      {
        "name": "Havana Club",
        "price": 80
      },
      {
        "name": "Hruškovice",
        "price": 80
      },
      {
        "name": "Jameson",
        "price": 80
      },
      {
        "name": "Jägermeister",
        "price": 80
      },
      {
        "name": "Republica",
        "price": 80
      },
      {
        "name": "Slivovice",
        "price": 80
      },
      {
        "name": "Tequila",
        "price": 80
      },
      {
        "name": "Legendario",
        "price": 120
      },
      {
        "name": "Metaxa",
        "price": 120
      }
    ]
  },
  {
    "id": "prosecco",
    "title": {
      "cz": "Prosecco",
      "en": "Prosecco"
    },
    "photo": null,
    "items": [
      {
        "name": "Prosecco 0,2 l",
        "price": 60
      }
    ]
  }
]'::jsonb,
  array['sklub/kava.jpg', 'sklub/obed.jpg', 'sklub/bubble-tea.jpg'],
  'https://sklubpixie.cz/',
  'sklub_pixie',
  '2026-11-08'::date,
  0
)
on conflict (id) do nothing;
