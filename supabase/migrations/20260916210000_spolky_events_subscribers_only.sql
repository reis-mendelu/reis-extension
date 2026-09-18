-- Per-event audience for society events on the campus map.
--
-- A society decides, when it publishes, whether the event belongs on everyone's
-- map or only on the maps of the students who follow it. Before this, every
-- event was on every map, which is the complaint: "students shouldn't see the
-- events of a society that's not theirs".
--
-- NOT A PERMISSION. This is noise control and nothing more. The map's fetch is
-- anonymous — the server has no idea who is asking, and subscriptions live in
-- the student's own IndexedDB, never here — so a restricted event still comes
-- down the wire and anyone reading the API sees it. Do not put anything private
-- behind this flag, and do not let a later change mistake it for access control.
--
-- Named for the RESTRICTION rather than the permission, so `false` is the
-- existing behaviour: every row already in this table becomes "everyone" by
-- default, and nothing published so far changes who can see it.
alter table public.spolky_events
  add column if not exists subscribers_only boolean not null default false;

comment on column public.spolky_events.subscribers_only is
  'Show this event only to students subscribed to the society. Client-side noise control, not access control: the row is still readable by anyone.';

notify pgrst, 'reload schema';
