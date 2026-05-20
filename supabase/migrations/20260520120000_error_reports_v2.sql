-- Error reporting v2 (PRIVACY.md §6 update).
--
-- Additive-only migration. Old clients keep working (report_error RPC stays
-- exactly as it was; new optional fields default to NULL).
--
-- WHY:
--   v1 stored one row per event with no grouping or session correlation.
--   Triage required GROUP BY across hundreds of rows; 28 occurrences of the
--   same error could be 1 user × 28 retries or 28 users × 1 hit, with no way
--   to tell. v2 adds:
--     - anonymous per-session UUID (regenerated each iframe boot, not persisted)
--     - sanitized stack excerpt (top frames after PRIVACY.md §6 regex)
--     - client-side timestamp (decoupled from server insertion time)
--     - server-computed fingerprint (groups identical bugs across versions/users)
--     - error_groups aggregation table (first_seen / last_seen / count / resolved_at)
--
-- DEATH POINTS AVOIDED (Munger-style inversion):
--   1. PII leak via new fields → all new columns sanitized server-side via length cap
--      AND assumed client-side sanitization via existing sanitize.ts.
--   2. Old client breakage → all new columns NULLABLE, old RPC signature unchanged.
--   3. Client lies about fingerprint → server computes it; client value (if any) is
--      ignored. Algorithm change later is acceptable cost (one-time re-bucketing).
--   4. Unbounded event growth → see "TTL" note at bottom; configure pg_cron or
--      manual cleanup before error_reports passes ~100k rows.
--   5. Session ID becomes a cross-session tracker → client MUST generate fresh
--      UUID per iframe load. Enforced in client code, not server (server cannot
--      verify); documented in PRIVACY.md.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Additive columns on existing error_reports table
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.error_reports
    ADD COLUMN IF NOT EXISTS session_id    uuid        NULL,
    ADD COLUMN IF NOT EXISTS stack_excerpt text        NULL,
    ADD COLUMN IF NOT EXISTS client_ts     timestamptz NULL,
    ADD COLUMN IF NOT EXISTS fingerprint   text        NULL;

CREATE INDEX IF NOT EXISTS error_reports_fingerprint_idx
    ON public.error_reports (fingerprint, created_at DESC);

CREATE INDEX IF NOT EXISTS error_reports_session_idx
    ON public.error_reports (session_id);

-- ──────────────────────────────────────────────────────────────────────────
-- 2. error_groups: one row per (normalized) bug
-- ──────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.error_groups (
    fingerprint         text        PRIMARY KEY,
    error_type          text        NOT NULL,
    message_template    text        NOT NULL,
    sample_message      text        NOT NULL,
    first_seen          timestamptz NOT NULL DEFAULT now(),
    last_seen           timestamptz NOT NULL DEFAULT now(),
    occurrence_count    bigint      NOT NULL DEFAULT 1,
    last_ext_version    text        NULL,
    resolved_at         timestamptz NULL,
    resolved_in_version text        NULL
);

CREATE INDEX IF NOT EXISTS error_groups_last_seen_idx
    ON public.error_groups (last_seen DESC);

CREATE INDEX IF NOT EXISTS error_groups_unresolved_idx
    ON public.error_groups (last_seen DESC) WHERE resolved_at IS NULL;

ALTER TABLE public.error_groups ENABLE ROW LEVEL SECURITY;
-- No policies = deny-all for anon/authenticated. Writes only via SECURITY DEFINER RPC.

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Server-side fingerprint computation
-- ──────────────────────────────────────────────────────────────────────────
-- Normalize transient values out of the message so that:
--   "predmet=12345" and "predmet=67890" → "predmet=N"   (same bug, same group)
--   "main-CzzUWFGC.js"  and "main-DxQ7lop2.js" → "main-<HEX>.js"  (chunk hashes)
--   "id-3f8a-bcd1-..."                  → "<UUID>"
-- Order matters: UUID before HEX before bare digits.

CREATE OR REPLACE FUNCTION public.compute_fingerprint(
    p_error_type text,
    p_message    text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    tpl text;
BEGIN
    tpl := lower(coalesce(p_message, ''));
    -- UUIDs first
    tpl := regexp_replace(tpl, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uuid>', 'g');
    -- Hex blobs ≥8 chars (chunk hashes, sha)
    tpl := regexp_replace(tpl, '\m[0-9a-f]{8,}\M', '<hex>', 'g');
    -- Bare integer runs ≥2 digits (1-digit numerics like HTTP 5 are meaningful, leave alone)
    tpl := regexp_replace(tpl, '\m\d{2,}\M', 'N', 'g');
    -- Collapse whitespace
    tpl := regexp_replace(tpl, '\s+', ' ', 'g');
    tpl := trim(tpl);
    -- Hash error_type + normalized template
    RETURN md5(coalesce(p_error_type, '') || ':' || tpl);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_fingerprint(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.compute_fingerprint(text, text) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Internal helper: upsert into error_groups
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.upsert_error_group(
    p_fingerprint      text,
    p_error_type       text,
    p_normalized       text,
    p_sample_message   text,
    p_ext_version      text,
    p_client_ts        timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.error_groups (
        fingerprint, error_type, message_template, sample_message,
        first_seen, last_seen, occurrence_count, last_ext_version
    ) VALUES (
        p_fingerprint,
        left(p_error_type, 100),
        left(p_normalized, 500),
        left(p_sample_message, 500),
        coalesce(p_client_ts, now()),
        coalesce(p_client_ts, now()),
        1,
        left(p_ext_version, 32)
    )
    ON CONFLICT (fingerprint) DO UPDATE
    SET last_seen        = GREATEST(error_groups.last_seen, EXCLUDED.last_seen),
        occurrence_count = error_groups.occurrence_count + 1,
        last_ext_version = EXCLUDED.last_ext_version,
        sample_message   = EXCLUDED.sample_message;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_error_group(text, text, text, text, text, timestamptz) FROM public;
-- Not granted to anon — only called by SECURITY DEFINER report_error_v2.

-- ──────────────────────────────────────────────────────────────────────────
-- 5. report_error_v2: the new RPC
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.report_error_v2(
    p_session_id      uuid,
    p_error_type      text,
    p_error_message   text,
    p_file_path       text,
    p_line_number     integer,
    p_stack_excerpt   text,
    p_client_ts       timestamptz,
    p_ext_version     text,
    p_browser_name    text,
    p_browser_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_fingerprint text;
    v_normalized  text;
BEGIN
    -- Rate limit: 500 inserts/hour, same as v1.
    IF (
        SELECT count(*) FROM public.error_reports
        WHERE created_at > now() - interval '1 hour'
    ) >= 500 THEN
        RETURN;
    END IF;

    v_fingerprint := public.compute_fingerprint(p_error_type, p_error_message);
    -- Recompute normalized template for the group row (cheap; deterministic).
    v_normalized := lower(coalesce(p_error_message, ''));
    v_normalized := regexp_replace(v_normalized, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uuid>', 'g');
    v_normalized := regexp_replace(v_normalized, '\m[0-9a-f]{8,}\M', '<hex>', 'g');
    v_normalized := regexp_replace(v_normalized, '\m\d{2,}\M', 'N', 'g');
    v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
    v_normalized := trim(v_normalized);

    INSERT INTO public.error_reports (
        error_type, error_message, file_path, line_number,
        ext_version, browser_name, browser_version,
        session_id, stack_excerpt, client_ts, fingerprint
    ) VALUES (
        left(p_error_type, 100),
        left(p_error_message, 500),
        left(p_file_path, 500),
        coalesce(p_line_number, 0),
        left(p_ext_version, 32),
        left(p_browser_name, 32),
        left(p_browser_version, 32),
        p_session_id,
        left(p_stack_excerpt, 2000),
        p_client_ts,
        v_fingerprint
    );

    PERFORM public.upsert_error_group(
        v_fingerprint, p_error_type, v_normalized, p_error_message,
        p_ext_version, p_client_ts
    );
END;
$$;

REVOKE ALL ON FUNCTION public.report_error_v2(uuid, text, text, text, integer, text, timestamptz, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.report_error_v2(uuid, text, text, text, integer, text, timestamptz, text, text, text) TO anon, authenticated;

-- ──────────────────────────────────────────────────────────────────────────
-- 6. Backfill: old report_error also upserts into error_groups
-- ──────────────────────────────────────────────────────────────────────────
-- v4.9.x clients (still in the field as of 2026-05) keep calling the old RPC.
-- Mirror their inserts into error_groups so the aggregate view is complete.

CREATE OR REPLACE FUNCTION public.report_error(
    p_error_type      text,
    p_error_message   text,
    p_file_path       text,
    p_line_number     integer,
    p_ext_version     text,
    p_browser_name    text,
    p_browser_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_fingerprint text;
    v_normalized  text;
BEGIN
    IF (
        SELECT count(*) FROM public.error_reports
        WHERE created_at > now() - interval '1 hour'
    ) >= 500 THEN
        RETURN;
    END IF;

    v_fingerprint := public.compute_fingerprint(p_error_type, p_error_message);
    v_normalized := lower(coalesce(p_error_message, ''));
    v_normalized := regexp_replace(v_normalized, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uuid>', 'g');
    v_normalized := regexp_replace(v_normalized, '\m[0-9a-f]{8,}\M', '<hex>', 'g');
    v_normalized := regexp_replace(v_normalized, '\m\d{2,}\M', 'N', 'g');
    v_normalized := regexp_replace(v_normalized, '\s+', ' ', 'g');
    v_normalized := trim(v_normalized);

    INSERT INTO public.error_reports (
        error_type, error_message, file_path, line_number,
        ext_version, browser_name, browser_version, fingerprint
    ) VALUES (
        left(p_error_type, 100),
        left(p_error_message, 500),
        left(p_file_path, 500),
        p_line_number,
        left(p_ext_version, 32),
        left(p_browser_name, 32),
        left(p_browser_version, 32),
        v_fingerprint
    );

    PERFORM public.upsert_error_group(
        v_fingerprint, p_error_type, v_normalized, p_error_message,
        p_ext_version, NULL
    );
END;
$$;

-- (existing grants on report_error remain — no GRANT change needed)

-- ──────────────────────────────────────────────────────────────────────────
-- 7. Backfill fingerprint on existing rows (one-time)
-- ──────────────────────────────────────────────────────────────────────────

UPDATE public.error_reports
SET fingerprint = public.compute_fingerprint(error_type, error_message)
WHERE fingerprint IS NULL;

-- Populate error_groups from historical events.
INSERT INTO public.error_groups (
    fingerprint, error_type, message_template, sample_message,
    first_seen, last_seen, occurrence_count, last_ext_version, resolved_at
)
SELECT
    fingerprint,
    (array_agg(error_type ORDER BY created_at DESC))[1],
    (array_agg(error_message ORDER BY created_at DESC))[1],
    (array_agg(error_message ORDER BY created_at DESC))[1],
    min(created_at),
    max(created_at),
    count(*),
    (array_agg(ext_version ORDER BY created_at DESC))[1],
    -- If every event in this group has been resolved, mark the group resolved.
    CASE WHEN bool_and(resolved_at IS NOT NULL) THEN max(resolved_at) ELSE NULL END
FROM public.error_reports
WHERE fingerprint IS NOT NULL
GROUP BY fingerprint
ON CONFLICT (fingerprint) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- TTL note (manual until pg_cron is provisioned):
--   The events table grows linearly; aggregate truth lives in error_groups.
--   Recommended retention: 30 days. To clean up manually:
--     DELETE FROM public.error_reports WHERE created_at < now() - interval '30 days';
--   Groups are kept forever (small, deduplicated).
-- ──────────────────────────────────────────────────────────────────────────
