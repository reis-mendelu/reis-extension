-- "Always an event": every post has a date + venue_kind (already NOT NULL).
-- Enforce the venue-specific location requirements at the DB level too.
ALTER TABLE public.spolky_events
  ADD CONSTRAINT spolky_events_campus_room_chk
    CHECK (venue_kind <> 'campus' OR room_code IS NOT NULL),
  ADD CONSTRAINT spolky_events_offcampus_coords_chk
    CHECK (venue_kind <> 'offcampus' OR (coord_lng IS NOT NULL AND coord_lat IS NOT NULL));
