-- A 'tba' event is list-only BECAUSE it has no place: the client pins anything
-- with a coordinate and flies to anything with a room code. A row marked 'tba'
-- that still carried either would be pinned while its card says "Místo upřesní",
-- so the database refuses the combination, the same way campus/offcampus rows
-- are held to theirs (spolky_events_venue_invariants).
-- Adding a place later is an UPDATE to campus/offcampus, which this allows.
-- `location` (free text) is deliberately not covered: a hint like "Brno" is fine.
alter table public.spolky_events drop constraint if exists spolky_events_tba_no_place_chk;
alter table public.spolky_events add constraint spolky_events_tba_no_place_chk
  check (venue_kind <> 'tba' or (room_code is null and coord_lng is null and coord_lat is null));

notify pgrst, 'reload schema';
