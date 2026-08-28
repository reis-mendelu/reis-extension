-- Real attendance for society events.
--
-- The going / interested numbers on an event card were invented client-side:
-- src/data/mockSocial.ts hashed the event id into a plausible-looking pair, so
-- a card with nobody attending advertised "108 zájemců". That is fabricated
-- social proof shown to students, and it shipped. This is the backend that
-- replaces it; the mock is deleted in the same change.
--
-- Identity is the SHA-256 of the student's IS id, hashed on the client, exactly
-- as feedback_responses and daily_active_usage do. The raw id never reaches
-- Supabase, and the hash is only ever used as an opaque per-student key: the
-- table answers "how many" and "did I", never "who".

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  event_id   uuid        NOT NULL REFERENCES public.spolky_events(id) ON DELETE CASCADE,
  student_id text        NOT NULL,
  status     text        NOT NULL CHECK (status IN ('going', 'interested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- One response per student per event: switching Going→Interested is an
  -- update, not a second row, so the counts cannot double-count anybody.
  PRIMARY KEY (event_id, student_id),
  -- 64 lowercase hex = SHA-256. A raw six-digit IS id fails this, so a client
  -- that forgets to hash is rejected by the database rather than quietly
  -- writing a real student number into a table that must not hold one.
  CONSTRAINT event_rsvps_student_id_is_sha256 CHECK (student_id ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS event_rsvps_event_id_idx ON public.event_rsvps (event_id);

-- Deny-all: no direct row access for anon or authenticated. Every read and
-- write goes through the SECURITY DEFINER functions below, which return counts
-- and the caller's own status — never another student's hash.
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_rsvps FROM anon, authenticated;

-- Set, change, or clear the caller's RSVP. p_status NULL clears it (tapping the
-- active choice again un-RSVPs), which is why this is not a plain upsert.
CREATE OR REPLACE FUNCTION public.set_event_rsvp(
  p_event_id   uuid,
  p_student_id text,
  p_status     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_student_id !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'student id must be a sha-256 hex digest';
  END IF;

  IF p_status IS NULL THEN
    DELETE FROM public.event_rsvps
     WHERE event_id = p_event_id AND student_id = p_student_id;
    RETURN;
  END IF;

  IF p_status NOT IN ('going', 'interested') THEN
    RAISE EXCEPTION 'unknown rsvp status: %', p_status;
  END IF;

  INSERT INTO public.event_rsvps (event_id, student_id, status)
  VALUES (p_event_id, p_student_id, p_status)
  ON CONFLICT (event_id, student_id)
  DO UPDATE SET status = EXCLUDED.status, updated_at = now();
END;
$$;

-- Counts for a set of events plus the caller's own answer, in one round trip:
-- the map draws every visible event's card from the same payload.
--
-- p_student_id may be NULL (a student whose id has not loaded yet, or demo
-- mode): the counts still come back, my_status is simply null.
CREATE OR REPLACE FUNCTION public.get_event_rsvps(
  p_event_ids  uuid[],
  p_student_id text DEFAULT NULL
)
RETURNS TABLE (
  event_id          uuid,
  going_count       bigint,
  interested_count  bigint,
  my_status         text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    e.event_id,
    count(*) FILTER (WHERE e.status = 'going')       AS going_count,
    count(*) FILTER (WHERE e.status = 'interested')  AS interested_count,
    max(e.status) FILTER (WHERE e.student_id = p_student_id) AS my_status
  FROM public.event_rsvps e
  WHERE e.event_id = ANY(p_event_ids)
  GROUP BY e.event_id;
$$;

REVOKE ALL ON FUNCTION public.set_event_rsvp(uuid, text, text)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_event_rsvps(uuid[], text)     FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_event_rsvp(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_event_rsvps(uuid[], text)    TO anon, authenticated;
