-- One emoji per society event (docs/superpowers/specs/2026-10-08-event-emoji-design.md).
--
-- A Twemoji codepoint filename ('26f8', '1f1eb-1f1ee'). Format-checked, not
-- enumerated: the shipped set lives in src/data/eventEmoji.ts and grows without
-- a migration, and a build that does not ship a code falls back to `category`.
-- `category` keeps its CHECK: builds 5.1.1–5.3.0 render it unchecked and never
-- read this column.
alter table public.spolky_events add column if not exists emoji text;

alter table public.spolky_events drop constraint if exists spolky_events_emoji_format;
alter table public.spolky_events add constraint spolky_events_emoji_format
  check (emoji is null or emoji ~ '^[0-9a-f]{2,6}(-[0-9a-f]{2,6})*$');

comment on column public.spolky_events.emoji is
  'Twemoji codepoint filename shown for the event; null = the category''s emoji.';
