-- A post is either an EVENT (it happens somewhere, at a time: the map's Akce
-- list and pins show it) or a NOTICE (an announcement: Novinky only).
--
-- Both were one `spolky_events` row with nothing to tell them apart, so a
-- notice like "Hledáš bydlení v Brně?" showed in Akce among the parties.
--
-- Expand-only, safe for every released build (checked v5.1.1 … v5.4.1):
--  * their inserts (societyPosts.toRow) send no `kind`, so the default files
--    every post they write as an event, exactly what it was before;
--  * their edits (composerPost.toPatch) send no `kind`, so an edit made from
--    an old console keeps whatever the row already is;
--  * their reads select `*` or named columns, and nothing parses a row
--    strictly, so an extra column is ignored. They do not filter on it either:
--    a notice stays in an old build's Akce list until the student updates.
--
-- No rule ties a notice to venue_kind 'tba': the new composer writes one that
-- way, but an old console editing a notice could place it in a room, and a
-- constraint would turn that save into a silent failure for the society.
alter table public.spolky_events
  add column kind text not null default 'event';

alter table public.spolky_events
  add constraint spolky_events_kind_check check (kind in ('event', 'notice'));

comment on column public.spolky_events.kind is
  'event = shown in the map''s Akce list and as a pin, and in Novinky; notice = Novinky only.';
