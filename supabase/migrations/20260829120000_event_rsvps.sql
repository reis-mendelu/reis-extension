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
--
-- Second consequence: an identity the caller mints is an identity the caller
-- can mint again, so the counts are inflatable in principle. That is inherent
-- to answering anonymously and is not solvable by tightening this function —
-- the alternative is requiring a login, which would reintroduce exactly the
-- identifier this migration exists to remove. What IS done about it is a
-- per-event hourly cap on FIRST answers (below), bounding a scripted caller
-- without ever throttling a student changing their own mind.

DROP FUNCTION IF EXISTS public.get_event_rsvps(uuid[], text);
DROP FUNCTION IF EXISTS public.set_event_rsvp(uuid, text, text);
DROP TABLE IF EXISTS public.event_rsvps;

CREATE TABLE public.event_rsvps (
  event_id   uuid        NOT NULL REFERENCES public.spolky_events(id) ON DELETE CASCADE,
  install_id uuid        NOT NULL,
  -- NULL means withdrawn. Kept as a short-lived tombstone rather than deleting
  -- the row outright, so that re-answering is recognised as a CHANGE and is
  -- never charged to the first-answer cap below. Both count queries use
  -- FILTER (WHERE status = ...), so a NULL is excluded from the totals for free.
  -- The tombstone is deleted once it is older than the rate-limit window (see
  -- set_event_rsvp), so withdrawal still erases the row — within the hour, not
  -- instantly. Nothing about the student is in it either way: just a random
  -- install UUID.
  status     text        NULL CHECK (status IS NULL OR status IN ('going', 'interested')),
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
DECLARE
  v_recent int;
BEGIN
  -- Every path through this function is serialised per event, and the lock is
  -- taken first thing for two separate reasons.
  --
  -- Withdrawal used to run outside it. Two contexts sharing an install id — two
  -- IS Mendelu tabs, which share IndexedDB and therefore the id, but not the
  -- client's in-memory write queue — could then submit a first answer and a
  -- withdrawal concurrently: the unlocked UPDATE matched zero rows, the locked
  -- INSERT landed afterwards, and the withdrawn RSVP stayed and stayed counted.
  -- That outcome corresponds to no serial order of the two calls at all.
  --
  -- And on the insert path the lock must precede the existence check, because
  -- checking first reads a snapshot the lock then invalidates: two overlapping
  -- writes for one install could both see "no row", and the one that took the
  -- lock second would put what is by then an UPDATE through the first-answer
  -- cap, rejecting a legitimate Going->Interested switch at a busy event.
  --
  -- Released at commit. Contention is per event and the body is a small sweep
  -- plus two indexed reads.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_event_id::text));

  -- Sweep tombstones that have outlived the rate-limit window they exist for.
  -- Opportunistic rather than scheduled: the only reader of a tombstone is the
  -- cap below, so once it is older than the window it has no purpose and the
  -- row goes. Scoped to this event, so the work stays proportional.
  DELETE FROM public.event_rsvps
   WHERE event_id = p_event_id
     AND status IS NULL
     AND updated_at < now() - interval '1 hour';

  IF p_status IS NULL THEN
    -- Withdrawal marks the row rather than removing it, so a student who
    -- changes their mind again is not mistaken for a brand-new respondent and
    -- refused by the first-answer cap. No-op when there is nothing to withdraw.
    UPDATE public.event_rsvps
       SET status = NULL, updated_at = now()
     WHERE event_id = p_event_id AND install_id = p_install_id;
    RETURN;
  END IF;

  IF p_status NOT IN ('going', 'interested') THEN
    RAISE EXCEPTION 'unknown rsvp status: %', p_status;
  END IF;

  -- A caller-supplied identity can be minted at will, so a fresh UUID per
  -- request would let anyone inflate a count without limit. Nothing anonymous
  -- can make that impossible; a cap makes it bounded and slow, which is the
  -- same posture report_error_v2 and check_and_log_booking already take.
  --
  -- Only FIRST answers are counted. Changing, withdrawing, or returning after a
  -- withdrawal all touch an existing row and must never be throttled — a
  -- student toggling Going/Interested on a popular event is not an attacker.
  -- This is exactly why withdrawal tombstones rather than deletes: without the
  -- row, coming back would look like a new identity and could be refused at a
  -- busy event, which is the opposite of the contract stated here.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_rsvps
     WHERE event_id = p_event_id AND install_id = p_install_id
  ) THEN
    SELECT count(*) INTO v_recent
      FROM public.event_rsvps
     WHERE event_id = p_event_id
       AND created_at > now() - interval '1 hour';

    -- Deliberately generous: a real MENDELU society event drawing 300 first
    -- answers inside one hour would be the largest in the app's history, so the
    -- cap costs nothing real while bounding a scripted caller to 300/hour.
    IF v_recent >= 300 THEN
      RAISE EXCEPTION 'rsvp rate limit reached for this event';
    END IF;
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
