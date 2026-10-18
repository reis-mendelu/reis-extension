-- Unify events + notifications: spolky_events becomes the single "society post".
ALTER TABLE public.spolky_events
  ADD COLUMN IF NOT EXISTS body         text,
  ADD COLUMN IF NOT EXISTS created_by   text,
  ADD COLUMN IF NOT EXISTS view_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS click_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visible_from timestamptz;
