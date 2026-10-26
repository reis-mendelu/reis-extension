-- Run after the migrations; rolls back.
begin;

insert into public.societies (id, name, short_name, color, faculty_key) values ('pin_test', 'Pin test', 'PT', '#000000', 'pef')
on conflict (id) do nothing;

insert into public.map_pins (association_id, title, coord_lng, coord_lat, starts_at, ends_at) values
  ('pin_test', 'live', 16.6142, 49.2098, now() - interval '1 day', now() + interval '30 days'),
  ('pin_test', 'over', 16.6142, 49.2098, now() - interval '40 days', now() - interval '10 days'),
  ('pin_test', 'later', 16.6142, 49.2098, now() + interval '1 day', now() + interval '30 days');

-- a student sees only the live pin
do $$
declare n int; t text;
begin
  set local role anon;
  select count(*), min(title) into n, t from public.map_pins where association_id = 'pin_test';
  reset role;
  if n <> 1 or t <> 'live' then raise exception 'anon saw % pins (%)', n, t; end if;
end $$;

-- a student cannot write one
do $$
begin
  set local role anon;
  insert into public.map_pins (association_id, title, coord_lng, coord_lat, ends_at)
  values ('pin_test', 'x', 16.6, 49.2, now() + interval '1 day');
  raise exception 'anon inserted a pin';
exception when insufficient_privilege then reset role;
end $$;

-- a coordinate outside Brno or an http link is refused
do $$
begin
  insert into public.map_pins (association_id, title, coord_lng, coord_lat, ends_at)
  values ('pin_test', 'x', 0, 0, now() + interval '1 day');
  raise exception 'accepted a pin outside Brno';
exception when check_violation then null;
end $$;
do $$
begin
  insert into public.map_pins (association_id, title, url, coord_lng, coord_lat, ends_at)
  values ('pin_test', 'x', 'http://vazbic.example', 16.6, 49.2, now() + interval '1 day');
  raise exception 'accepted an http link';
exception when check_violation then null;
end $$;

rollback;
