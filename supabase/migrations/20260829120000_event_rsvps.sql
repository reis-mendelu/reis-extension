-- Attendance for society events, keyed on a random per-install id.
--
-- The first cut of this table keyed rows on SHA-256 of the student's IS id,
-- following feedback_responses and daily_active_usage. That is not
-- anonymisation: IS ids are six or seven digits, so the whole preimage space is
-- under ten million and a rainbow table builds in seconds. The digest was
-- therefore a RECOVERABLE student identifier, and because `get_event_rsvps`
-- accepted it as an argument, anyone could ask "did this student say they were
-- going" for any student and any event. reIS's central promise is that student
-- data never leaves the device, so that had to go rather than be tightened.
--
-- What replaces it is a random UUID minted on first use and kept in IndexedDB.
-- It carries no relationship to the person; it exists only so a device can be
-- counted once and can change or withdraw its own answer.
--
-- Consequence, accepted deliberately: this counts INSTALLS, not people. One
-- student on a phone and a tablet counts twice, and a reinstall counts again.
-- Where a per-person number is needed, ask the student rather than infer it.

DROP FUNCTION IF EXISTS public.get_event_rsvps(uuid[], text);
DROP FUNCTION IF EXISTS public.set_event_rsvp(uuid, text, text);
DROP TABLE IF EXISTS public.event_rsvps;

CREATE TABLE public.event_rsvps (
  event_id   uuid        NOT NULL REFERENCES public.spolky_events(id) ON DELETE CASCADE,
  install_id uuid        NOT NULL,
  status     text        NOT NULL CHECK (status IN ('going', 'interested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One answer per install per event, so switching Going->Interested is an
  -- update rather than a second row and the counts cannot double-count.
  PRIMARY KEY (event_id, install_id)
);

CREATE INDEX event_rsvps_event_id_idx ON public.event_rsvps (event_id);

-- Deny-all: no direct row access. Everything goes through the two functions
-- below, and neither of them can be asked about a person.
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_rsvps FROM anon, authenticated;

-- Set, change, or clear this install's answer. NULL clears it, which is what
-- tapping the active choice again does.
--
-- install_id is a 128-bit random value known only to the device that minted it.
-- It is an argument rather than a derived value because the server has no other
-- way to know which row to update — but unlike a hashed student id it cannot be
-- guessed, enumerated, or tied back to a student.
CREATE OR REPLACE FUNCTION public.set_event_rsvp(
  p_event_id   uuid,
  p_install_id uuid,
  p_status     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_status IS NULL THEN
    DELETE FROM public.event_rsvps
     WHERE event_id = p_event_id AND install_id = p_install_id;
    RETURN;
  END IF;

  IF p_status NOT IN ('going', 'interested') THEN
    RAISE EXCEPTION 'unknown rsvp status: %', p_status;
  END IF;

  INSERT INTO public.event_rsvps (event_id, install_id, status)
  VALUES (p_event_id, p_install_id, p_status)
  ON CONFLICT (event_id, install_id)
  DO UPDATE SET status = EXCLUDED.status, updated_at = now();
END;
$$;

-- Counts only. There is deliberately no "my status" here and no identity
-- argument: the device already knows its own answer (it is kept in IndexedDB),
-- so exposing a per-identity read would add a lookup oracle and buy nothing.
CREATE OR REPLACE FUNCTION public.get_event_rsvps(p_event_ids uuid[])
RETURNS TABLE (
  event_id         uuid,
  going_count      bigint,
  interested_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    e.event_id,
    count(*) FILTER (WHERE e.status = 'going')      AS going_count,
    count(*) FILTER (WHERE e.status = 'interested') AS interested_count
  FROM public.event_rsvps e
  WHERE e.event_id = ANY(p_event_ids)
  GROUP BY e.event_id;
$$;

REVOKE ALL ON FUNCTION public.set_event_rsvp(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_event_rsvps(uuid[])          FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_event_rsvp(uuid, uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_rsvps(uuid[])          TO anon, authenticated;
