-- Map opens per event, for the society that owns the event (2026-11-24).
--
-- The console's Akce row showed Novinky views and clicks only. An event a week
-- or more out is on the map (14-day pin window) but not yet in Novinky (7-day
-- week), so it could be opened by dozens of devices and still read "0 views,
-- 0 clicks". The opens are in event_map_views, which has row level security on
-- and no read policy, so a society's own session cannot select from it.
--
-- This reads them under the definer's rights, for ONE society: the caller's own
-- (get_my_association) or any, for a reis_admin. Anyone else gets no rows, not
-- an error. It returns a per-event total and nothing else: event_map_views holds
-- no identifier, so there is nothing here that says which install opened what.
--
-- Additive: a new function. Released builds never call it. A console running
-- before this lands gets an error from the RPC and simply shows no map figure.

create or replace function public.society_event_map_views(p_association_id text)
returns table (id uuid, map_views bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select e.id, coalesce(sum(v.views), 0)::bigint
    from public.spolky_events e
    left join public.event_map_views v on v.event_id = e.id
   where e.association_id = p_association_id
     and (
       p_association_id = public.get_my_association()
       or coalesce(public.get_my_role(), '') = 'reis_admin'
     )
   group by e.id
$$;

revoke all on function public.society_event_map_views(text) from public, anon;
grant execute on function public.society_event_map_views(text) to authenticated;
