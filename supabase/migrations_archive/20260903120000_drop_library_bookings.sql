-- Library study-room booking is removed from reIS (see the PR that deletes
-- supabase/functions/bookings-create and bookings-availability).
--
-- A migration, not a delete of 20260717120000_library_bookings_rate_limit.sql:
-- that file is applied history, and removing it would leave these objects in
-- every environment that already ran it while making the repo claim they never
-- existed. Drop them forward instead.
--
-- library_bookings_log held only sha256(salt || studentId) hashes and
-- timestamps for the per-student hourly cap — never a raw ID, name or email —
-- so there is nothing here to preserve.

drop function if exists public.check_and_log_booking(text, int);
drop table if exists public.library_bookings_log;
