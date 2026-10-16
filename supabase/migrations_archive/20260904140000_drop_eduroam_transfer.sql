-- Remove the eduroam desktop→phone transfer.
--
-- It existed for one case: reIS running in a desktop browser, setting up a
-- PHONE. The desktop uploaded the profile to a short-TTL row and showed a QR
-- pointing at the eduroam-receive function, which served it once and burned it.
--
-- The reIS app now configures eduroam through the OS itself — Android via
-- ACTION_WIFI_ADD_NETWORKS, iOS via NEHotspotConfigurationManager — so a phone
-- needs no desktop and no QR. The browser drawer now offers only the machine it
-- is running on (mac, windows), both of which download a file locally and never
-- touched this path.
--
-- 33 rows were ever written, between 2026-06-16 and 2026-08-07, all of them the
-- team's own testing.
--
-- The `eduroam-receive` edge function is deleted separately; it is the only
-- caller of take_eduroam_transfer, so it goes first.

drop function if exists public.put_eduroam_transfer(uuid, text, int);
drop function if exists public.take_eduroam_transfer(uuid);

do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
      from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('put_eduroam_transfer', 'take_eduroam_transfer')
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

drop table if exists public.eduroam_transfers;
