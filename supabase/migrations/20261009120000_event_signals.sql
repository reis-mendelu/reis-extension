-- Three per-event numbers for the admin console (spec 2026-10-08): Seen,
-- Opened, Link tapped. Each counted once per DEVICE by the client, which keeps
-- its own record of what it already sent; the server receives an event id and
-- nothing else, rolled up per event per day. `views` stays for old builds'
-- once-per-session opens (increment_event_map_view) and is not displayed —
-- mixing the two would make the numbers mean nothing.
--
-- Additive only: three new columns with defaults, two new functions. Released
-- builds never read the new columns, and increment_event_map_view writes
-- `views` explicitly, so applying this early breaks nothing deployed.
alter table public.event_map_views
  add column if not exists seen      integer not null default 0,
  add column if not exists opened    integer not null default 0,
  add column if not exists link_taps integer not null default 0;

create or replace function public.increment_event_signal(row_id uuid, signal text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- An unknown signal is dropped rather than raised: a future client sending a
  -- name this deployment has not learned must not error in a student's face.
  if signal not in ('seen', 'opened', 'link') then
    return;
  end if;
  insert into public.event_map_views (event_id, view_date, views, seen, opened, link_taps)
  values (row_id, current_date, 0,
          (signal = 'seen')::int, (signal = 'opened')::int, (signal = 'link')::int)
  on conflict (event_id, view_date) do update set
    seen      = public.event_map_views.seen      + (signal = 'seen')::int,
    opened    = public.event_map_views.opened    + (signal = 'opened')::int,
    link_taps = public.event_map_views.link_taps + (signal = 'link')::int;
exception
  -- An event deleted since the student saw it: a race, not a fault (same
  -- reasoning as increment_event_map_view).
  when foreign_key_violation then
    return;
end;
$$;

revoke all on function public.increment_event_signal(uuid, text) from public;
grant execute on function public.increment_event_signal(uuid, text) to anon, authenticated;

-- Totals per event, for reis_admin or for the society that owns the event.
create or replace function public.event_signals(p_event_ids uuid[])
returns table (event_id uuid, seen bigint, opened bigint, link_taps bigint)
language sql stable security definer set search_path = '' as $$
  select v.event_id, sum(v.seen), sum(v.opened), sum(v.link_taps)
  from public.event_map_views v
  join public.spolky_events e on e.id = v.event_id
  where v.event_id = any(p_event_ids)
    and (coalesce(public.get_my_role(), '') = 'reis_admin'
         or e.association_id = public.get_my_association())
  group by v.event_id;
$$;

revoke all on function public.event_signals(uuid[]) from public, anon;
grant execute on function public.event_signals(uuid[]) to authenticated;

-- PostgREST caches function signatures seen at boot; without this the new RPCs
-- 404 until the schema cache next reloads on its own.
notify pgrst, 'reload schema';
