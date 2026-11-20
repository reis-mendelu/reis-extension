-- Run after the migrations; rolls back.
begin;

insert into public.societies (id, name, short_name, color, faculty_key) values ('venue_test', 'Venue test', 'VT', '#000000', 'frrms')
on conflict (id) do nothing;

insert into public.venues (id, association_id, title, kind, place, address, coord_lng, coord_lat, is_active) values
  ('venue-on', 'venue_test', 'on', '{"cz":"Kavárna"}', '{"cz":"Budova Z"}', '{"cz":"Přízemí"}', 16.6143, 49.2181, true),
  ('venue-off', 'venue_test', 'off', '{"cz":"Kavárna"}', '{"cz":"Budova Z"}', '{"cz":"Přízemí"}', 16.6143, 49.2181, false);

-- the migration seeds S-klub
do $$
begin
  if not exists (select 1 from public.venues where id = 'sklub' and is_active) then
    raise exception 'S-klub was not seeded';
  end if;
end $$;

-- 20261109160000 seeds design lab's espresso bar, under a society that is hidden
do $$
begin
  if not exists (
    select 1 from public.venues v join public.societies s on s.id = v.association_id
    where v.id = 'designlab' and v.is_active and not s.is_active and v.menu = '[]'::jsonb
  ) then
    raise exception 'design lab was not seeded as a venue of a hidden society';
  end if;
end $$;

-- a student sees only active venues
do $$
declare n int; t text;
begin
  set local role anon;
  select count(*), min(title) into n, t from public.venues where association_id = 'venue_test';
  reset role;
  if n <> 1 or t <> 'on' then raise exception 'anon saw % venues (%)', n, t; end if;
end $$;

-- a student cannot write one
do $$
begin
  set local role anon;
  update public.venues set title = 'x' where id = 'venue-on';
  raise exception 'anon updated a venue';
exception when insufficient_privilege then reset role;
end $$;

-- a closure needs both ends, in order; a coordinate outside Brno is refused
do $$
begin
  update public.venues set closed_from = '2026-11-10' where id = 'venue-on';
  raise exception 'accepted a closure with no end';
exception when check_violation then null;
end $$;
do $$
begin
  update public.venues set closed_from = '2026-11-10', closed_until = '2026-11-09' where id = 'venue-on';
  raise exception 'accepted a closure ending before it starts';
exception when check_violation then null;
end $$;
do $$
begin
  update public.venues set coord_lng = 0 where id = 'venue-on';
  raise exception 'accepted a venue outside Brno';
exception when check_violation then null;
end $$;

-- the photo bucket is public, JPEG/WebP only
do $$
begin
  if not exists (
    select 1 from storage.buckets
    where id = 'venue-photos' and public and allowed_mime_types @> array['image/jpeg']
  ) then
    raise exception 'venue-photos bucket missing or not public';
  end if;
end $$;

rollback;
