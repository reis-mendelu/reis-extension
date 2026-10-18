-- BASELINE: prod's database (reis-notifications, zvbpgkmnrqyprtkyxkwn) as it
-- stood on 2026-10-16, so this directory can rebuild it from nothing.
--
-- The 45 files before it are in supabase/migrations_archive/, kept for their
-- reasoning. They cannot be replayed: several were written against a schema
-- that already existed, and some prod functions were changed by hand after
-- their migration ran. This file replaces all of them.
--
-- How it was made (read-only against prod):
--   1. npx supabase db dump --linked -s public       -> the public schema below
--   2. the extensions, storage buckets + policies and the pg_cron job that the
--      dump leaves out, read from prod's catalogs  -> appended at the end
--   3. revokes for every grant a fresh Supabase adds by default but prod does
--      not have                                     -> appended at the end
-- No table data: prod's rows are student-derived and stay there.
--
-- Left out on purpose:
--   - private_backups.tutorial_slides_backup_2026_01_19: a data backup, not schema.
--   - auth users (the societies' logins) and vault secrets: data, and secret.
--
-- Proof that it equals prod: `supabase db diff --linked` and
-- supabase/scripts/catalog_fingerprint.sql, both empty (see the PR that added
-- this file). New migrations go on top of this one; nothing is changed in prod
-- by hand.

-- Extensions. A fresh Supabase already has most of these; the IF NOT EXISTS
-- makes that harmless. They have to exist before the tables, whose defaults
-- call extensions.uuid_generate_v4().
create extension if not exists "pg_cron" with schema "pg_catalog";
create extension if not exists "pg_stat_statements" with schema "extensions";
create extension if not exists "pgcrypto" with schema "extensions";
create extension if not exists "uuid-ossp" with schema "extensions";
create extension if not exists "supabase_vault" with schema "vault";




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."check_and_log_suggestion"("p_ip_hash" "text", "p_max" integer DEFAULT 5) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  recent int;
begin
  -- Serialize concurrent submissions from the same source so check-then-insert
  -- cannot race (TOCTOU): two parallel requests could otherwise both read the
  -- old count and both insert, bypassing the cap. Released at commit.
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));

  -- Prune. This table must not become a growing record of who submitted from
  -- where; one hour of history is all the cap needs.
  delete from public.suggestions_rate_log
   where created_at < now() - interval '1 hour';

  select count(*) into recent
    from public.suggestions_rate_log
   where ip_hash = p_ip_hash
     and created_at > now() - interval '1 hour';

  if recent >= p_max then
    return false;
  end if;

  insert into public.suggestions_rate_log (ip_hash) values (p_ip_hash);
  return true;
end;
$$;


ALTER FUNCTION "public"."check_and_log_suggestion"("p_ip_hash" "text", "p_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_and_log_suggestion_bucket"("p_bucket" "text", "p_max" integer DEFAULT 100) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  recent int;
begin
  perform pg_advisory_xact_lock(hashtext(p_bucket));
  delete from public.suggestions_rate_log
   where created_at < now() - interval '1 hour';
  select count(*) into recent
    from public.suggestions_rate_log
   where ip_hash = p_bucket
     and created_at > now() - interval '1 hour';
  if recent >= p_max then
    return false;
  end if;
  insert into public.suggestions_rate_log (ip_hash) values (p_bucket);
  return true;
end;
$$;


ALTER FUNCTION "public"."check_and_log_suggestion_bucket"("p_bucket" "text", "p_max" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."compute_fingerprint"("p_error_type" "text", "p_message" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
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


ALTER FUNCTION "public"."compute_fingerprint"("p_error_type" "text", "p_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_course_tip"("p_student_id" "text", "p_course_code" "text", "p_semester_code" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    DELETE FROM course_tips
    WHERE student_id = p_student_id
    AND course_code = p_course_code
    AND semester_code = p_semester_code;
END; $$;


ALTER FUNCTION "public"."delete_course_tip"("p_student_id" "text", "p_course_code" "text", "p_semester_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."drop_attachments_when_done"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from public.suggestion_attachments where suggestion_id = new.id;
  return new;
end;
$$;


ALTER FUNCTION "public"."drop_attachments_when_done"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."feature_stats"("p_days" integer) RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.feature_stats_unchecked(p_days);
end $$;


ALTER FUNCTION "public"."feature_stats"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."feature_stats_unchecked"("p_days" integer) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with bounds as (
    select current_date - greatest(1, least(coalesce(p_days, 30), 365)) + 1 as from_date
  ),
  win as (
    select f.* from public.feature_usage f, bounds b where f.usage_date >= b.from_date
  ),
  per as (
    select feature, count(distinct install_id) as installs, sum(hits)::bigint as hits
      from win group by feature
  ),
  -- Only features that cleared the floor; see the note above.
  publishable as (
    select feature from per where installs >= 5
  ),
  per_day as (
    select w.usage_date, w.feature, count(distinct w.install_id) as installs
      from win w
     where w.feature in (select feature from publishable)
     group by 1, 2
  ),
  ev as (
    select e.event_id, sum(e.views)::bigint as views
      from public.event_map_views e, bounds b
     where e.view_date >= b.from_date
     group by e.event_id
  ),
  top as (
    select ev.event_id, s.title, ev.views
      from ev join public.spolky_events s on s.id = ev.event_id
     order by ev.views desc, s.title
     limit 10
  ),
  ev_day as (
    select e.view_date, e.event_id, e.views
      from public.event_map_views e, bounds b
     where e.view_date >= b.from_date
       and e.event_id in (select event_id from top)
  )
  select json_build_object(
    'by_feature', coalesce((select json_agg(json_build_object(
        'feature',  feature,
        'installs', case when installs < 5 then -1 else installs end,
        'hits',     case when installs < 5 then -1 else hits end
      ) order by feature) from per), '[]'::json),
    'daily', coalesce((select json_agg(json_build_object(
        'day',      usage_date,
        'feature',  feature,
        'installs', installs
      ) order by usage_date, feature) from per_day), '[]'::json),
    -- Event titles are society-published public content, not student data, and
    -- this function is reis_admin-only regardless.
    'top_events', coalesce((select json_agg(json_build_object(
        'id',        event_id,
        'title',     title,
        'map_views', views
      ) order by views desc, title) from top), '[]'::json),
    'event_daily', coalesce((select json_agg(json_build_object(
        'day',      view_date,
        'event_id', event_id,
        'views',    views
      ) order by view_date) from ev_day), '[]'::json)
  );
$$;


ALTER FUNCTION "public"."feature_stats_unchecked"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_course_tips"("p_course_code" "text", "p_semester_code" "text") RETURNS TABLE("tip_text" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT ct.tip_text, ct.created_at
    FROM course_tips ct
    WHERE ct.course_code = p_course_code
    AND ct.semester_code = p_semester_code
    ORDER BY ct.created_at DESC
    LIMIT 20;
END; $$;


ALTER FUNCTION "public"."get_course_tips"("p_course_code" "text", "p_semester_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_course_tips_with_votes"("p_course_code" "text", "p_semester_code" "text", "p_student_id" "text") RETURNS TABLE("tip_id" bigint, "tip_text" "text", "created_at" timestamp with time zone, "helpful_count" bigint, "voted_by_me" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT
        ct.id AS tip_id,
        ct.tip_text,
        ct.created_at,
        (SELECT count(*) FROM tip_votes tv WHERE tv.tip_id = ct.id) AS helpful_count,
        EXISTS (SELECT 1 FROM tip_votes tv WHERE tv.tip_id = ct.id AND tv.student_id = p_student_id) AS voted_by_me
    FROM course_tips ct
    WHERE ct.course_code = p_course_code
    AND ct.semester_code = p_semester_code
    ORDER BY ct.created_at DESC
    LIMIT 20;
END; $$;


ALTER FUNCTION "public"."get_course_tips_with_votes"("p_course_code" "text", "p_semester_code" "text", "p_student_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_error_summary"() RETURNS TABLE("error_type" "text", "error_message" "text", "file_path" "text", "line_number" integer, "occurrence_count" bigint, "affected_versions" "text"[], "first_seen" timestamp with time zone, "last_seen" timestamp with time zone, "is_resolved" boolean, "resolved_in_version" "text", "resolution_note" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF get_my_role() <> 'reis_admin' THEN
        RAISE EXCEPTION 'reis_admin role required';
    END IF;

    RETURN QUERY
    SELECT
        er.error_type,
        er.error_message,
        er.file_path,
        er.line_number,
        count(*)::bigint                                                    AS occurrence_count,
        array_agg(DISTINCT er.ext_version ORDER BY er.ext_version DESC)    AS affected_versions,
        min(er.created_at)                                                  AS first_seen,
        max(er.created_at)                                                  AS last_seen,
        (res.res_id IS NOT NULL)                                            AS is_resolved,
        res.res_version,
        res.res_note
    FROM public.error_reports er
    LEFT JOIN LATERAL (
        SELECT r.id AS res_id, r.resolved_in_version AS res_version, r.note AS res_note
        FROM public.error_resolutions r
        WHERE r.error_type    = er.error_type
          AND r.error_message = er.error_message
          AND r.file_path     = er.file_path
          AND r.line_number   = er.line_number
        ORDER BY r.resolved_at DESC
        LIMIT 1
    ) res ON true
    GROUP BY er.error_type, er.error_message, er.file_path, er.line_number,
             res.res_id, res.res_version, res.res_note
    ORDER BY (res.res_id IS NOT NULL), max(er.created_at) DESC;
END;
$$;


ALTER FUNCTION "public"."get_error_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_event_rsvps"("p_event_ids" "uuid"[]) RETURNS TABLE("event_id" "uuid", "going_count" bigint, "interested_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT
    e.event_id,
    count(*) FILTER (WHERE e.status = 'going')      AS going_count,
    count(*) FILTER (WHERE e.status = 'interested') AS interested_count
  FROM public.event_rsvps e
  WHERE e.event_id = ANY(p_event_ids)
  GROUP BY e.event_id;
$$;


ALTER FUNCTION "public"."get_event_rsvps"("p_event_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_association"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select association_id from public.spolky_accounts
   where user_id = auth.uid() and is_active = true
   limit 1;
$$;


ALTER FUNCTION "public"."get_my_association"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_course_tip"("p_student_id" "text", "p_course_code" "text", "p_semester_code" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_tip text;
BEGIN
    SELECT ct.tip_text INTO v_tip
    FROM course_tips ct
    WHERE ct.student_id = p_student_id
    AND ct.course_code = p_course_code
    AND ct.semester_code = p_semester_code;

    RETURN v_tip;
END; $$;


ALTER FUNCTION "public"."get_my_course_tip"("p_student_id" "text", "p_course_code" "text", "p_semester_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from public.spolky_accounts
   where user_id = auth.uid() and is_active = true
   limit 1;
$$;


ALTER FUNCTION "public"."get_my_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_unique_active_users"("p_days" integer) RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT count(DISTINCT student_id)::integer
    FROM public.daily_active_usage
    WHERE usage_date >= current_date - greatest(p_days, 1);
$$;


ALTER FUNCTION "public"."get_unique_active_users"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_usage_stats"("p_days" integer DEFAULT 90) RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT jsonb_build_object(
        'distinctByPeriod', (
            SELECT jsonb_agg(
                jsonb_build_object('days', d, 'count', (
                    SELECT count(DISTINCT student_id)
                    FROM public.daily_active_usage
                    WHERE usage_date >= current_date - d
                ))
                ORDER BY d
            )
            FROM unnest(ARRAY[7, 14, 21, 30]) AS d
        ),
        'dailyTrend', (
            SELECT coalesce(
                jsonb_agg(
                    jsonb_build_object('date', usage_date, 'count', c)
                    ORDER BY usage_date
                ),
                '[]'::jsonb
            )
            FROM (
                SELECT usage_date, count(DISTINCT student_id) AS c
                FROM public.daily_active_usage
                WHERE usage_date >= current_date - greatest(p_days, 1)
                GROUP BY usage_date
            ) t
        )
    );
$$;


ALTER FUNCTION "public"."get_usage_stats"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_event_map_view"("row_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.event_map_views (event_id, view_date, views)
  values (row_id, current_date, 1)
  on conflict (event_id, view_date)
    do update set views = public.event_map_views.views + 1;
exception
  -- A view of an event that has since been deleted is a race, not a fault, and
  -- it must not surface to a student as a failed request over a counter.
  --
  -- Handled here rather than with a `select 1 from spolky_events` first: an
  -- unlocked existence check is a TOCTOU gap, because `deletePost` can remove
  -- the row between the check and the insert, and the foreign key then raises
  -- anyway. Catching the violation covers the deleted-mid-write case AND the
  -- never-existed case in one, with no lock taken on the event row.
  when foreign_key_violation then
    return;
end;
$$;


ALTER FUNCTION "public"."increment_event_map_view"("row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_post_click"("row_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.spolky_events SET click_count = click_count + 1 WHERE id = row_id;
END;
$$;


ALTER FUNCTION "public"."increment_post_click"("row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_post_view"("row_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  UPDATE public.spolky_events SET view_count = view_count + 1 WHERE id = row_id;
END;
$$;


ALTER FUNCTION "public"."increment_post_view"("row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_suggestion_attachments"() RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  delete from public.suggestion_attachments
   where created_at < now() - interval '90 days';
$$;


ALTER FUNCTION "public"."prune_suggestion_attachments"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_error_cluster"("p_error_type" "text", "p_error_message" "text", "p_file_path" "text", "p_line_number" integer, "p_resolved_in_version" "text", "p_note" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF get_my_role() <> 'reis_admin' THEN
        RAISE EXCEPTION 'reis_admin role required';
    END IF;

    INSERT INTO public.error_resolutions (
        error_type, error_message, file_path, line_number,
        resolved_in_version, note
    ) VALUES (
        left(p_error_type, 100),
        left(p_error_message, 500),
        left(p_file_path, 500),
        p_line_number,
        left(p_resolved_in_version, 32),
        left(coalesce(p_note, ''), 500)
    );
END;
$$;


ALTER FUNCTION "public"."resolve_error_cluster"("p_error_type" "text", "p_error_message" "text", "p_file_path" "text", "p_line_number" integer, "p_resolved_in_version" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_event_rsvp"("p_event_id" "uuid", "p_install_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  v_recent int;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(p_event_id::text));

  -- Global, not scoped to this event: a withdrawal from an event nobody touches
  -- again would otherwise keep its install id indefinitely.
  DELETE FROM public.event_rsvps
   WHERE status IS NULL
     AND updated_at < now() - interval '1 hour';

  IF p_status IS NULL THEN
    UPDATE public.event_rsvps
       SET status = NULL, updated_at = now()
     WHERE event_id = p_event_id AND install_id = p_install_id;
    RETURN;
  END IF;

  IF p_status NOT IN ('going', 'interested') THEN
    RAISE EXCEPTION 'unknown rsvp status: %', p_status;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.event_rsvps
     WHERE event_id = p_event_id AND install_id = p_install_id
  ) THEN
    SELECT count(*) INTO v_recent
      FROM public.event_rsvps
     WHERE event_id = p_event_id
       AND created_at > now() - interval '1 hour';

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


ALTER FUNCTION "public"."set_event_rsvp"("p_event_id" "uuid", "p_install_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."societies_audience_valid"("p" "text"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $_$
  select p is null or (
    cardinality(p) > 0 and not exists (
      select 1 from unnest(p) t
       where t is null or t !~ '^(mendelu|(pef|af|ldf|zf|frrms)(:[A-Z]-[A-Z0-9]{1,10})?)$'))
$_$;


ALTER FUNCTION "public"."societies_audience_valid"("p" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."societies_guard"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.id <> old.id then
    raise exception 'societies.id is immutable: it is the society login';
  end if;
  new.updated_at := now();
  return new;
end $$;


ALTER FUNCTION "public"."societies_guard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_course_tip"("p_student_id" "text", "p_course_code" "text", "p_semester_code" "text", "p_tip_text" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF char_length(p_tip_text) < 3 OR char_length(p_tip_text) > 140 THEN
        RAISE EXCEPTION 'Tip must be between 3 and 140 characters';
    END IF;

    INSERT INTO course_tips (student_id, course_code, semester_code, tip_text)
    VALUES (p_student_id, p_course_code, p_semester_code, p_tip_text)
    ON CONFLICT (student_id, course_code, semester_code)
    DO UPDATE SET tip_text = EXCLUDED.tip_text, updated_at = now();
END; $$;


ALTER FUNCTION "public"."submit_course_tip"("p_student_id" "text", "p_course_code" "text", "p_semester_code" "text", "p_tip_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_feedback"("p_student_id" "text", "p_faculty_id" "text", "p_study_semester" integer, "p_feedback_type" "text", "p_value" "text", "p_semester_code" "text", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO feedback_responses (student_id, faculty_id, study_semester, feedback_type, value, semester_code, reason)
    VALUES (p_student_id, p_faculty_id, p_study_semester, p_feedback_type, p_value, p_semester_code, p_reason)
    ON CONFLICT (student_id, feedback_type, semester_code)
    DO UPDATE SET value = p_value, faculty_id = p_faculty_id, study_semester = p_study_semester,
        reason = p_reason, created_at = now();
END;
$$;


ALTER FUNCTION "public"."submit_feedback"("p_student_id" "text", "p_faculty_id" "text", "p_study_semester" integer, "p_feedback_type" "text", "p_value" "text", "p_semester_code" "text", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_suggestion"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text" DEFAULT NULL::"text", "p_ext_version" "text" DEFAULT ''::"text", "p_browser_name" "text" DEFAULT ''::"text", "p_browser_version" "text" DEFAULT ''::"text", "p_viewport" "text" DEFAULT ''::"text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_contact text := nullif(btrim(coalesce(p_contact, '')), '');
  v_screen text := btrim(coalesce(p_screen, ''));
begin
  if p_type is null or p_type not in ('bug', 'idea', 'other') then return false; end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then return false; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then return false; end if;
  if v_contact is not null and char_length(v_contact) > 120 then return false; end if;
  if char_length(v_screen) < 1 or char_length(v_screen) > 40 then return false; end if;
  if not public.check_and_log_suggestion_bucket(
    coalesce(nullif(btrim(p_browser_name), ''), 'unknown') || '|' ||
    coalesce(nullif(btrim(p_browser_version), ''), 'unknown')
  ) then return false; end if;
  insert into public.suggestions (
    type, title, body, contact, screen,
    ext_version, browser_name, browser_version, viewport
  ) values (
    p_type, v_title, v_body, v_contact, v_screen,
    left(coalesce(p_ext_version, ''), 20),
    left(coalesce(p_browser_name, ''), 20),
    left(coalesce(p_browser_version, ''), 10),
    left(coalesce(p_viewport, ''), 20)
  );
  return true;
end;
$$;


ALTER FUNCTION "public"."submit_suggestion"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_suggestion_v2"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text" DEFAULT NULL::"text", "p_ext_version" "text" DEFAULT ''::"text", "p_browser_name" "text" DEFAULT ''::"text", "p_browser_version" "text" DEFAULT ''::"text", "p_viewport" "text" DEFAULT ''::"text", "p_diagnostics" "jsonb" DEFAULT NULL::"jsonb", "p_screenshot" "text" DEFAULT NULL::"text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_title      text := btrim(coalesce(p_title, ''));
  v_body       text := btrim(coalesce(p_body, ''));
  v_contact    text := nullif(btrim(coalesce(p_contact, '')), '');
  v_screen     text := btrim(coalesce(p_screen, ''));
  v_id         bigint;
  v_shot       bytea;
  v_diag       jsonb := p_diagnostics;
  v_shot_lost  boolean := false;
  v_recent     int;
begin
  if p_type is null or p_type not in ('bug', 'idea', 'other') then
    return 'rejected';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    return 'rejected';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return 'rejected';
  end if;
  if v_contact is not null and char_length(v_contact) > 120 then
    return 'rejected';
  end if;
  if char_length(v_screen) < 1 or char_length(v_screen) > 40 then
    return 'rejected';
  end if;

  if not public.check_and_log_suggestion_bucket(
    coalesce(nullif(btrim(p_browser_name), ''), 'unknown') || '|' ||
    coalesce(nullif(btrim(p_browser_version), ''), 'unknown')
  ) then
    return 'rejected';
  end if;

  perform public.prune_suggestion_attachments();

  insert into public.suggestions (
    type, title, body, contact, screen,
    ext_version, browser_name, browser_version, viewport
  ) values (
    p_type, v_title, v_body, v_contact, v_screen,
    left(coalesce(p_ext_version, ''), 20),
    left(coalesce(p_browser_name, ''), 20),
    left(coalesce(p_browser_version, ''), 10),
    left(coalesce(p_viewport, ''), 20)
  ) returning id into v_id;

  -- Screenshot: decode, check, and hold to a GLOBAL budget of 30 an hour. The
  -- flood guard above is per browser|version and allows 100 an hour; at 600 KB
  -- each that is 60 MB an hour from one looping client, so images get their
  -- own, much smaller, allowance.
  if p_screenshot is not null then
    begin
      v_shot := decode(p_screenshot, 'base64');
    exception when others then
      v_shot := null;
    end;
    if v_shot is null
       or octet_length(v_shot) > 614400
       or substring(v_shot from 1 for 3) <> '\xffd8ff'::bytea then
      v_shot := null;
    else
      perform pg_advisory_xact_lock(hashtext('suggestion_attachments.screenshot_budget'));
      select count(*) into v_recent
        from public.suggestion_attachments
       where has_screenshot and created_at > now() - interval '1 hour';
      if v_recent >= 30 then
        v_shot := null;
      end if;
    end if;
    v_shot_lost := v_shot is null;
  end if;

  if v_diag is not null and not (
       jsonb_typeof(v_diag) = 'object'
       and jsonb_typeof(v_diag -> 'entries') = 'array'
       and jsonb_array_length(v_diag -> 'entries') <= 50
       and octet_length(v_diag::text) <= 32768) then
    v_diag := null;
  end if;

  if v_shot is not null or v_diag is not null then
    insert into public.suggestion_attachments (suggestion_id, screenshot, diagnostics)
    values (v_id, v_shot, v_diag);
  end if;

  return case when v_shot_lost then 'ok_without_screenshot' else 'ok' end;
end;
$$;


ALTER FUNCTION "public"."submit_suggestion_v2"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text", "p_diagnostics" "jsonb", "p_screenshot" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_daily_usage"("p_student_id" "text", "p_faculty" "text" DEFAULT NULL::"text", "p_platform" "text" DEFAULT NULL::"text", "p_programme" "text" DEFAULT NULL::"text", "p_app_version" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_platform text := case when p_platform in ('extension','ios','android','web') then p_platform else null end;
  v_faculty  text := case when upper(btrim(coalesce(p_faculty, ''))) in ('PEF','FRRMS','AF','ZF','LDF','ICV')
                      then upper(btrim(p_faculty)) end;
  v_programme text := case when upper(btrim(coalesce(p_programme, ''))) ~ '^[A-Z]-[A-Z0-9]{1,10}$'
                       then upper(btrim(p_programme)) end;
  v_app_version text := case when btrim(coalesce(p_app_version, '')) ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'
                         then btrim(p_app_version) end;
  v_day date := (now() at time zone 'Europe/Prague')::date;
begin
  insert into public.daily_active_usage (student_id, usage_date, open_count, faculty, platform, programme, app_version)
  values (p_student_id, v_day, 1, v_faculty, v_platform, v_programme, v_app_version)
  on conflict (student_id, usage_date) do update
    set open_count  = public.daily_active_usage.open_count + 1,
        faculty     = coalesce(excluded.faculty,     public.daily_active_usage.faculty),
        platform    = coalesce(excluded.platform,    public.daily_active_usage.platform),
        programme   = coalesce(excluded.programme,   public.daily_active_usage.programme),
        -- An update installed mid-day: the newer call wins.
        app_version = coalesce(excluded.app_version, public.daily_active_usage.app_version);
end $_$;


ALTER FUNCTION "public"."track_daily_usage"("p_student_id" "text", "p_faculty" "text", "p_platform" "text", "p_programme" "text", "p_app_version" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_feature_usage"("p_install_id" "text", "p_feature" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- An unknown label is dropped rather than stored or raised: a future client
  -- sending a key this deployment has not learned yet must not error in a
  -- student's face over a counter.
  if p_feature not in ('map_dwell_3s','eduroam_wifi_configured','eduroam_profile_delivered') then
    return;
  end if;
  insert into public.feature_usage (install_id, usage_date, feature, hits)
  values (p_install_id, current_date, p_feature, 1)
  on conflict (install_id, usage_date, feature)
    do update set hits = public.feature_usage.hits + 1;
end;
$$;


ALTER FUNCTION "public"."track_feature_usage"("p_install_id" "text", "p_feature" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_error_group"("p_fingerprint" "text", "p_error_type" "text", "p_normalized" "text", "p_sample_message" "text", "p_ext_version" "text", "p_client_ts" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."upsert_error_group"("p_fingerprint" "text", "p_error_type" "text", "p_normalized" "text", "p_sample_message" "text", "p_ext_version" "text", "p_client_ts" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usage_programmes"("p_days" integer) RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_programmes_unchecked(p_days);
end $$;


ALTER FUNCTION "public"."usage_programmes"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usage_programmes_unchecked"("p_days" integer) RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with
  now_day as (select (now() at time zone 'Europe/Prague')::date as d),
  span as (select greatest(1, least(coalesce(p_days, 30), 365)) as n),
  win as (
    select u.* from public.daily_active_usage u, now_day t, span
     where u.usage_date >= greatest(date '2026-09-07', t.d - (span.n - 1))
       and u.platform is distinct from 'web'
  ),
  latest as (
    select distinct on (student_id) student_id, faculty, programme
      from win where faculty is not null
     order by student_id, usage_date desc
  ),
  grouped as (
    select faculty || ' ' || coalesce(programme, '?') as key, count(*) as n
      from latest
     group by 1
  )
  select public.usage_suppress_groups(
    coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n)) from grouped), '[]'::jsonb));
$$;


ALTER FUNCTION "public"."usage_programmes_unchecked"("p_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usage_retention"() RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_retention_unchecked();
end $$;


ALTER FUNCTION "public"."usage_retention"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usage_retention_unchecked"() RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with
  shown as (
    select u.student_id, u.usage_date
      from public.daily_active_usage u
     where u.usage_date >= date '2026-09-07'
       and u.platform is distinct from 'web'
       -- A device only counts once IS has named a student on it (the app
       -- gates new writes on that since this change; see the header).
       and u.student_id in (select v.student_id from public.daily_active_usage v
                             where v.faculty is not null)
  ),
  -- Monday of each row's week, computed arithmetically rather than with
  -- date_trunc, which goes through timestamptz and the session time zone.
  regulars as (
    select student_id, max(usage_date) as last_day
      from shown
     where student_id in (
       select student_id
         from shown
        group by student_id, usage_date - (extract(isodow from usage_date)::int - 1)
       having count(distinct usage_date) >= 2
     )
     group by 1
  )
  select json_build_object(
    'regulars_ever', (select count(*) from regulars),
    'gone_quiet', (select count(*) from regulars
                    where last_day <= (now() at time zone 'Europe/Prague')::date - 14)
  );
$$;


ALTER FUNCTION "public"."usage_retention_unchecked"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usage_stats"("p_days" integer, "p_day" "date" DEFAULT NULL::"date") RETURNS json
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_stats_unchecked(p_days, p_day);
end $$;


ALTER FUNCTION "public"."usage_stats"("p_days" integer, "p_day" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usage_stats_unchecked"("p_days" integer, "p_day" "date" DEFAULT NULL::"date") RETURNS json
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with
  -- Every window below is anchored to the Prague day, matching the write path.
  now_day as (select (now() at time zone 'Europe/Prague')::date as d),

  -- What the dashboard is allowed to report on.
  --
  -- 2026-09-07 is the epoch. Before 2026-08-29 `student_id` was
  -- SHA-256(IS student id) — a stable per-STUDENT hash, 99 of them, a different
  -- unit from the random per-install UUID that replaced it; counting across that
  -- boundary makes every student "new" on the day the scheme changed. From
  -- 29 Aug to 6 Sept the UUID era is development traffic: StrictMode
  -- double-invokes effects in development builds only, so a dev boot leaves an
  -- EVEN open_count and a production boot an odd one, and 6 Sept alone is 121 of
  -- 127 rows at exactly 2. 2026-09-02..05 is 1188 of 1216 even, and 2 of its
  -- 1207 devices were ever seen again after 9 Sept.
  --
  -- platform = 'web' is the dev server: 164 rows, ZERO with an odd open_count.
  -- Nothing but `npm run dev:web` has ever written that label. If reIS ever
  -- ships a real web app, this exclusion has to be revisited.
  shown as (
    select u.* from public.daily_active_usage u
     where u.usage_date >= date '2026-09-07'
       and u.platform is distinct from 'web'
       -- A device only counts once IS has named a student on it (the app
       -- gates new writes on that since this change; see the header).
       and u.student_id in (select v.student_id from public.daily_active_usage v
                             where v.faculty is not null)
  ),

  -- first_seen spans the whole UUID era, not just the reported window, so the
  -- first day of the epoch is not reported as 100% new devices.
  seen as (
    select student_id, min(usage_date) as first_day
      from public.daily_active_usage
     where usage_date >= date '2026-08-29'
     group by 1
  ),

  span as (
    select greatest(1, least(coalesce(p_days, 30), 365)) as n from now_day
  ),
  win as (
    select s.* from shown s, now_day t, span
     where s.usage_date >= t.d - (span.n - 1)
  ),

  -- A full date spine, so a day with no activity is a zero rather than a gap
  -- the chart silently closes up.
  days as (
    select gs::date as day
      from now_day t, span,
           generate_series(greatest(date '2026-09-07', t.d - (span.n - 1)), t.d, interval '1 day') gs
  ),
  daily_raw as (
    select w.usage_date as day,
           count(distinct w.student_id) as active,
           count(distinct w.student_id) filter (where f.first_day = w.usage_date) as new_devices,
           count(distinct w.student_id) filter (where f.first_day < w.usage_date) as returning_devices
      from win w join seen f on f.student_id = w.student_id
     group by 1
  ),
  daily as (
    select d.day,
           coalesce(r.active, 0) as active,
           coalesce(r.new_devices, 0) as new_devices,
           coalesce(r.returning_devices, 0) as returning_devices
      from days d left join daily_raw r on r.day = d.day
  ),

  -- One bucket per device, keyed on its most recent non-null label.
  -- Counting distinct student_id per bucket instead put a device whose label
  -- changed (null -> ios, the week the columns were added) into TWO buckets:
  -- the bars summed to 429 against a window total of 423.
  devices as (select distinct student_id from win),
  -- The latest label is found once per device with DISTINCT ON, not by a
  -- subquery per device: `win` is a CTE with no index, so two correlated
  -- lookups against it cost devices x rows. At 2,488 devices and 12,477 rows
  -- (29 Sep 2026) that was 9.5 s, past the 8 s `authenticated` timeout.
  latest_platform as (
    select distinct on (student_id) student_id, platform
      from win where platform is not null
     order by student_id, usage_date desc
  ),
  latest_faculty as (
    select distinct on (student_id) student_id, faculty
      from win where faculty is not null
     order by student_id, usage_date desc
  ),
  labelled as (
    select d.student_id,
           coalesce(p.platform, 'unknown') as platform,
           coalesce(f.faculty, 'unknown') as faculty
      from devices d
      left join latest_platform p on p.student_id = d.student_id
      left join latest_faculty f on f.student_id = d.student_id
  ),
  plat as (select platform as key, count(*) as n from labelled group by 1),
  fac  as (select faculty  as key, count(*) as n from labelled group by 1),

  -- The picked day. Exactly one row per device per day, so bucketing on the
  -- row's own label lands each device once without the latest-label dance.
  pick as (select coalesce(p_day, (select d from now_day)) as d),
  day_rows as (select s.* from shown s, pick p where s.usage_date = p.d),
  day_plat as (
    select coalesce(platform, 'unknown') as key, count(distinct student_id) as n
      from day_rows group by 1
  )

  select json_build_object(
    'today', (select count(distinct student_id) from shown, now_day where usage_date = now_day.d),
    'd7',    (select count(distinct student_id) from shown, now_day where usage_date >= now_day.d - 6),
    'd30',   (select count(distinct student_id) from shown, now_day where usage_date >= now_day.d - 29),

    -- Daily totals carry no dimension to narrow on, so they are not suppressed —
    -- consistent with today/d7/d30, which have never been. Suppression applies
    -- where it does work: the breakdowns, via usage_suppress_groups above.
    'daily', coalesce((select json_agg(json_build_object(
                'day', day, 'active', active, 'new', new_devices, 'returning', returning_devices
              ) order by day) from daily), '[]'::json),

    'by_platform', public.usage_suppress_groups(
                     coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n)) from plat), '[]'::jsonb)),
    'by_faculty',  public.usage_suppress_groups(
                     coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n)) from fac), '[]'::jsonb)),

    'day', (select json_build_object(
              'day', p.d,
              'active', (select count(distinct r.student_id) from day_rows r),
              'new', (select count(distinct r.student_id) from day_rows r
                       join seen f on f.student_id = r.student_id where f.first_day = p.d),
              'returning', (select count(distinct r.student_id) from day_rows r
                             join seen f on f.student_id = r.student_id where f.first_day < p.d),
              'by_platform', public.usage_suppress_groups(
                               coalesce((select jsonb_agg(jsonb_build_object('key', key, 'n', n)) from day_plat), '[]'::jsonb))
            ) from pick p)
  );
$$;


ALTER FUNCTION "public"."usage_stats_unchecked"("p_days" integer, "p_day" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."usage_suppress_groups"("p_groups" "jsonb") RETURNS json
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public'
    AS $$
declare
  n bigint;
  hidden_cnt int := 0;
  hidden_sum bigint := 0;
  rank int := 0;
  cutoff int := 0;
  grand_total bigint;
begin
  -- A breakdown of a sub-floor population tells you everything about it, and
  -- the loop below cannot help: with a SINGLE bucket the bucket IS the total,
  -- so replacing it with -1 hides nothing once the total is published beside
  -- it. That case arises exactly when the group total is itself under the
  -- floor. Publish no breakdown at all there — the bare total stays, carrying
  -- no dimension to narrow on, which is the same line today/d7/d30 hold.
  select coalesce(sum((e->>'n')::bigint), 0) into grand_total
    from jsonb_array_elements(p_groups) e;
  if grand_total < 5 then
    return '[]'::json;
  end if;

  for n in
    select (e->>'n')::bigint from jsonb_array_elements(p_groups) e
     order by (e->>'n')::bigint asc
  loop
    rank := rank + 1;
    if n < 5 or hidden_cnt = 1 or (hidden_cnt > 0 and hidden_sum < 5) then
      hidden_cnt := hidden_cnt + 1;
      hidden_sum := hidden_sum + n;
      cutoff := rank;
    else
      exit;
    end if;
  end loop;

  return coalesce((
    select json_agg(json_build_object(
             'key', key, 'devices', case when rn <= cutoff then -1 else cnt end
           ) order by cnt desc)
      from (
        select e->>'key' as key,
               (e->>'n')::bigint as cnt,
               row_number() over (order by (e->>'n')::bigint asc) as rn
          from jsonb_array_elements(p_groups) e
      ) ranked
  ), '[]'::json);
end $$;


ALTER FUNCTION "public"."usage_suppress_groups"("p_groups" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."vote_tip_helpful"("p_student_id" "text", "p_tip_id" bigint) RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_existed boolean;
BEGIN
    DELETE FROM tip_votes
    WHERE tip_id = p_tip_id AND student_id = p_student_id
    RETURNING true INTO v_existed;

    IF v_existed IS NULL THEN
        INSERT INTO tip_votes (tip_id, student_id) VALUES (p_tip_id, p_student_id);
        RETURN true;  -- voted
    END IF;

    RETURN false;  -- unvoted
END; $$;


ALTER FUNCTION "public"."vote_tip_helpful"("p_student_id" "text", "p_tip_id" bigint) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."course_tips" (
    "id" bigint NOT NULL,
    "student_id" "text" NOT NULL,
    "course_code" "text" NOT NULL,
    "semester_code" "text" NOT NULL,
    "tip_text" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "course_tips_tip_text_check" CHECK ((("char_length"("tip_text") >= 3) AND ("char_length"("tip_text") <= 140)))
);


ALTER TABLE "public"."course_tips" OWNER TO "postgres";


ALTER TABLE "public"."course_tips" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."course_tips_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."daily_active_usage" (
    "student_id" "text" NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "open_count" integer DEFAULT 1 NOT NULL,
    "faculty" "text",
    "platform" "text",
    "programme" "text",
    "app_version" "text",
    CONSTRAINT "daily_active_usage_app_version_check" CHECK ((("app_version" IS NULL) OR ("app_version" ~ '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'::"text"))),
    CONSTRAINT "daily_active_usage_faculty_check" CHECK ((("faculty" IS NULL) OR ("faculty" = ANY (ARRAY['PEF'::"text", 'FRRMS'::"text", 'AF'::"text", 'ZF'::"text", 'LDF'::"text", 'ICV'::"text"])))),
    CONSTRAINT "daily_active_usage_platform_check" CHECK ((("platform" IS NULL) OR ("platform" = ANY (ARRAY['extension'::"text", 'ios'::"text", 'android'::"text", 'web'::"text"])))),
    CONSTRAINT "daily_active_usage_programme_check" CHECK ((("programme" IS NULL) OR ("programme" ~ '^[A-Z]-[A-Z0-9]{1,10}$'::"text")))
);


ALTER TABLE "public"."daily_active_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."error_resolutions" (
    "id" bigint NOT NULL,
    "error_type" "text" NOT NULL,
    "error_message" "text" NOT NULL,
    "file_path" "text" NOT NULL,
    "line_number" integer NOT NULL,
    "resolved_in_version" "text" NOT NULL,
    "note" "text",
    "resolved_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."error_resolutions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."error_resolutions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."error_resolutions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."error_resolutions_id_seq" OWNED BY "public"."error_resolutions"."id";



CREATE TABLE IF NOT EXISTS "public"."event_map_views" (
    "event_id" "uuid" NOT NULL,
    "view_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "views" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."event_map_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_rsvps" (
    "event_id" "uuid" NOT NULL,
    "install_id" "uuid" NOT NULL,
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_rsvps_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['going'::"text", 'interested'::"text"]))))
);


ALTER TABLE "public"."event_rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feature_usage" (
    "install_id" "text" NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "feature" "text" NOT NULL,
    "hits" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "feature_usage_feature_check" CHECK (("feature" = ANY (ARRAY['map_dwell_3s'::"text", 'eduroam_wifi_configured'::"text", 'eduroam_profile_delivered'::"text"]))),
    CONSTRAINT "feature_usage_install_id_check" CHECK ((("char_length"("install_id") >= 8) AND ("char_length"("install_id") <= 64)))
);


ALTER TABLE "public"."feature_usage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feedback_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "text" NOT NULL,
    "faculty_id" "text",
    "study_semester" integer,
    "feedback_type" "text" NOT NULL,
    "value" "text" NOT NULL,
    "semester_code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reason" "text",
    CONSTRAINT "feedback_responses_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['nps'::"text", 'one_change'::"text"]))),
    CONSTRAINT "feedback_responses_reason_check" CHECK (("reason" = ANY (ARRAY['missing_feature'::"text", 'bug'::"text", 'confusing'::"text", 'slow'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."feedback_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."societies" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text" NOT NULL,
    "color" "text" NOT NULL,
    "faculty_key" "text" NOT NULL,
    "auto_follow_faculty" boolean DEFAULT false NOT NULL,
    "audience_label" "text",
    "logo_path" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "instagram" "text",
    "kind" "text" DEFAULT 'society'::"text" NOT NULL,
    "audience" "text"[],
    "mark_light_path" "text",
    "mark_dark_path" "text",
    CONSTRAINT "societies_audience_check" CHECK ("public"."societies_audience_valid"("audience")),
    CONSTRAINT "societies_audience_label_check" CHECK (("audience_label" = 'erasmus'::"text")),
    CONSTRAINT "societies_check" CHECK ((("logo_path" IS NULL) OR ("logo_path" ~ (('^'::"text" || "id") || '/[0-9a-f]{32}\.png$'::"text")))),
    CONSTRAINT "societies_check1" CHECK ((("mark_light_path" IS NULL) OR ("mark_light_path" ~ (('^'::"text" || "id") || '/[0-9a-f]{32}\.png$'::"text")))),
    CONSTRAINT "societies_check2" CHECK ((("mark_dark_path" IS NULL) OR ("mark_dark_path" ~ (('^'::"text" || "id") || '/[0-9a-f]{32}\.png$'::"text")))),
    CONSTRAINT "societies_color_check" CHECK (("color" ~ '^#[0-9a-fA-F]{6}$'::"text")),
    CONSTRAINT "societies_faculty_key_check" CHECK (("faculty_key" = ANY (ARRAY['mendelu'::"text", 'pef'::"text", 'af'::"text", 'ldf'::"text", 'zf'::"text", 'frrms'::"text"]))),
    CONSTRAINT "societies_id_check" CHECK (("id" ~ '^[a-z0-9][a-z0-9_-]*$'::"text")),
    CONSTRAINT "societies_instagram_check" CHECK ((("instagram" IS NULL) OR ("instagram" ~ '^[A-Za-z0-9._]{1,30}$'::"text"))),
    CONSTRAINT "societies_kind_check" CHECK (("kind" = ANY (ARRAY['society'::"text", 'partner'::"text"]))),
    CONSTRAINT "societies_name_check" CHECK ((("length"("btrim"("name")) >= 1) AND ("length"("btrim"("name")) <= 80))),
    CONSTRAINT "societies_partner_has_audience" CHECK ((("kind" <> 'partner'::"text") OR ("audience" IS NOT NULL))),
    CONSTRAINT "societies_short_name_check" CHECK ((("length"("btrim"("short_name")) >= 1) AND ("length"("btrim"("short_name")) <= 24)))
);


ALTER TABLE "public"."societies" OWNER TO "postgres";


COMMENT ON COLUMN "public"."societies"."instagram" IS 'Instagram handle without @. The client builds the URL; it is never stored.';



CREATE TABLE IF NOT EXISTS "public"."spolky_accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "email" "text" NOT NULL,
    "association_id" "text" NOT NULL,
    "association_name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "role" "text" DEFAULT 'association'::"text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    CONSTRAINT "spolky_accounts_role_check" CHECK (("role" = ANY (ARRAY['association'::"text", 'reis_admin'::"text"])))
);


ALTER TABLE "public"."spolky_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spolky_events" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "association_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" NOT NULL,
    "date" "date" NOT NULL,
    "end_date" "date",
    "time" "text",
    "venue_kind" "text" NOT NULL,
    "room_code" "text",
    "coord_lng" double precision,
    "coord_lat" double precision,
    "location" "text",
    "url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "body" "text",
    "created_by" "text",
    "view_count" integer DEFAULT 0 NOT NULL,
    "click_count" integer DEFAULT 0 NOT NULL,
    "visible_from" timestamp with time zone,
    "subscribers_only" boolean DEFAULT false NOT NULL,
    "emoji" "text",
    CONSTRAINT "spolky_events_campus_room_chk" CHECK ((("venue_kind" <> 'campus'::"text") OR ("room_code" IS NOT NULL))),
    CONSTRAINT "spolky_events_category_check" CHECK (("category" = ANY (ARRAY['party'::"text", 'boardgames'::"text", 'trip'::"text", 'quiz'::"text", 'sports'::"text", 'film'::"text", 'karaoke'::"text", 'culture'::"text", 'social'::"text", 'other'::"text"]))),
    CONSTRAINT "spolky_events_emoji_format" CHECK ((("emoji" IS NULL) OR ("emoji" ~ '^[0-9a-f]{2,6}(-[0-9a-f]{2,6})*$'::"text"))),
    CONSTRAINT "spolky_events_offcampus_coords_chk" CHECK ((("venue_kind" <> 'offcampus'::"text") OR (("coord_lng" IS NOT NULL) AND ("coord_lat" IS NOT NULL)))),
    CONSTRAINT "spolky_events_tba_no_place_chk" CHECK ((("venue_kind" <> 'tba'::"text") OR (("room_code" IS NULL) AND ("coord_lng" IS NULL) AND ("coord_lat" IS NULL)))),
    CONSTRAINT "spolky_events_venue_kind_check" CHECK (("venue_kind" = ANY (ARRAY['campus'::"text", 'online'::"text", 'offcampus'::"text", 'tba'::"text"])))
);


ALTER TABLE "public"."spolky_events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."spolky_events"."subscribers_only" IS 'Show this event only to students subscribed to the society. Client-side noise control, not access control: the row is still readable by anyone.';



COMMENT ON COLUMN "public"."spolky_events"."emoji" IS 'Twemoji codepoint filename shown for the event; null = the category''s emoji.';



CREATE TABLE IF NOT EXISTS "public"."suggestion_attachments" (
    "suggestion_id" bigint NOT NULL,
    "screenshot" "bytea",
    "diagnostics" "jsonb",
    "has_screenshot" boolean GENERATED ALWAYS AS (("screenshot" IS NOT NULL)) STORED,
    "diagnostics_count" integer GENERATED ALWAYS AS (
CASE
    WHEN ("jsonb_typeof"(("diagnostics" -> 'entries'::"text")) = 'array'::"text") THEN "jsonb_array_length"(("diagnostics" -> 'entries'::"text"))
    ELSE 0
END) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "suggestion_attachments_diagnostics_shape" CHECK ((("diagnostics" IS NULL) OR (("jsonb_typeof"("diagnostics") = 'object'::"text") AND ("jsonb_typeof"(("diagnostics" -> 'entries'::"text")) = 'array'::"text") AND ("jsonb_array_length"(("diagnostics" -> 'entries'::"text")) <= 50) AND ("octet_length"(("diagnostics")::"text") <= 32768)))),
    CONSTRAINT "suggestion_attachments_not_empty" CHECK ((("screenshot" IS NOT NULL) OR ("diagnostics" IS NOT NULL))),
    CONSTRAINT "suggestion_attachments_screenshot_jpeg" CHECK ((("screenshot" IS NULL) OR (("octet_length"("screenshot") <= 614400) AND (SUBSTRING("screenshot" FROM 1 FOR 3) = '\xffd8ff'::"bytea"))))
);


ALTER TABLE "public"."suggestion_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."suggestions" (
    "id" bigint NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "contact" "text",
    "screen" "text" NOT NULL,
    "ext_version" "text" DEFAULT ''::"text" NOT NULL,
    "browser_name" "text" DEFAULT ''::"text" NOT NULL,
    "browser_version" "text" DEFAULT ''::"text" NOT NULL,
    "viewport" "text" DEFAULT ''::"text" NOT NULL,
    "status" "text" DEFAULT 'new'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "suggestions_body_check" CHECK ((("char_length"("body") >= 1) AND ("char_length"("body") <= 2000))),
    CONSTRAINT "suggestions_contact_check" CHECK (("char_length"("contact") <= 120)),
    CONSTRAINT "suggestions_screen_check" CHECK (("char_length"("screen") <= 40)),
    CONSTRAINT "suggestions_status_check" CHECK (("status" = ANY (ARRAY['new'::"text", 'triaged'::"text", 'done'::"text"]))),
    CONSTRAINT "suggestions_title_check" CHECK ((("char_length"("title") >= 1) AND ("char_length"("title") <= 120))),
    CONSTRAINT "suggestions_type_check" CHECK (("type" = ANY (ARRAY['bug'::"text", 'idea'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."suggestions" OWNER TO "postgres";


ALTER TABLE "public"."suggestions" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."suggestions_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."suggestions_rate_log" (
    "id" bigint NOT NULL,
    "ip_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."suggestions_rate_log" OWNER TO "postgres";


ALTER TABLE "public"."suggestions_rate_log" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."suggestions_rate_log_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



ALTER TABLE ONLY "public"."error_resolutions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."error_resolutions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."course_tips"
    ADD CONSTRAINT "course_tips_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."course_tips"
    ADD CONSTRAINT "course_tips_student_id_course_code_semester_code_key" UNIQUE ("student_id", "course_code", "semester_code");



ALTER TABLE ONLY "public"."daily_active_usage"
    ADD CONSTRAINT "daily_active_usage_pkey" PRIMARY KEY ("student_id", "usage_date");



ALTER TABLE ONLY "public"."error_resolutions"
    ADD CONSTRAINT "error_resolutions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_map_views"
    ADD CONSTRAINT "event_map_views_pkey" PRIMARY KEY ("event_id", "view_date");



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("event_id", "install_id");



ALTER TABLE ONLY "public"."feature_usage"
    ADD CONSTRAINT "feature_usage_pkey" PRIMARY KEY ("install_id", "usage_date", "feature");



ALTER TABLE ONLY "public"."feedback_responses"
    ADD CONSTRAINT "feedback_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."societies"
    ADD CONSTRAINT "societies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spolky_accounts"
    ADD CONSTRAINT "spolky_accounts_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."spolky_accounts"
    ADD CONSTRAINT "spolky_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spolky_accounts"
    ADD CONSTRAINT "spolky_accounts_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."spolky_events"
    ADD CONSTRAINT "spolky_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suggestion_attachments"
    ADD CONSTRAINT "suggestion_attachments_pkey" PRIMARY KEY ("suggestion_id");



ALTER TABLE ONLY "public"."suggestions"
    ADD CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suggestions_rate_log"
    ADD CONSTRAINT "suggestions_rate_log_pkey" PRIMARY KEY ("id");



CREATE INDEX "event_rsvps_event_id_idx" ON "public"."event_rsvps" USING "btree" ("event_id");



CREATE INDEX "idx_course_tips_lookup" ON "public"."course_tips" USING "btree" ("course_code", "semester_code");



CREATE UNIQUE INDEX "idx_feedback_unique" ON "public"."feedback_responses" USING "btree" ("student_id", "feedback_type", "semester_code");



CREATE UNIQUE INDEX "societies_one_auto_follow_per_faculty" ON "public"."societies" USING "btree" ("faculty_key") WHERE "auto_follow_faculty";



CREATE INDEX "suggestion_attachments_created_at" ON "public"."suggestion_attachments" USING "btree" ("created_at");



CREATE INDEX "suggestions_rate_log_hash_time" ON "public"."suggestions_rate_log" USING "btree" ("ip_hash", "created_at");



CREATE INDEX "suggestions_status_time" ON "public"."suggestions" USING "btree" ("status", "created_at" DESC);



CREATE OR REPLACE TRIGGER "societies_guard" BEFORE UPDATE ON "public"."societies" FOR EACH ROW EXECUTE FUNCTION "public"."societies_guard"();



CREATE OR REPLACE TRIGGER "suggestions_drop_attachments_when_done" AFTER UPDATE OF "status" ON "public"."suggestions" FOR EACH ROW WHEN ((("new"."status" = 'done'::"text") AND ("old"."status" IS DISTINCT FROM 'done'::"text"))) EXECUTE FUNCTION "public"."drop_attachments_when_done"();



ALTER TABLE ONLY "public"."event_map_views"
    ADD CONSTRAINT "event_map_views_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."spolky_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."spolky_events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spolky_accounts"
    ADD CONSTRAINT "spolky_accounts_association_id_fkey" FOREIGN KEY ("association_id") REFERENCES "public"."societies"("id") ON UPDATE RESTRICT ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."spolky_accounts"
    ADD CONSTRAINT "spolky_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."suggestion_attachments"
    ADD CONSTRAINT "suggestion_attachments_suggestion_id_fkey" FOREIGN KEY ("suggestion_id") REFERENCES "public"."suggestions"("id") ON DELETE CASCADE;



CREATE POLICY "Admin read daily_active_usage" ON "public"."daily_active_usage" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'reis_admin'::"text"));



CREATE POLICY "Admin read feedback_responses" ON "public"."feedback_responses" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'reis_admin'::"text"));



CREATE POLICY "Admin read suggestion attachments" ON "public"."suggestion_attachments" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'reis_admin'::"text"));



CREATE POLICY "Admin read suggestions" ON "public"."suggestions" FOR SELECT TO "authenticated" USING (("public"."get_my_role"() = 'reis_admin'::"text"));



CREATE POLICY "Admin update suggestion status" ON "public"."suggestions" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'reis_admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'reis_admin'::"text"));



CREATE POLICY "Deny delete daily_active_usage" ON "public"."daily_active_usage" FOR DELETE USING (false);



CREATE POLICY "Deny delete feedback_responses" ON "public"."feedback_responses" FOR DELETE USING (false);



CREATE POLICY "Deny insert daily_active_usage" ON "public"."daily_active_usage" FOR INSERT WITH CHECK (false);



CREATE POLICY "Deny insert feedback_responses" ON "public"."feedback_responses" FOR INSERT WITH CHECK (false);



CREATE POLICY "Deny update daily_active_usage" ON "public"."daily_active_usage" FOR UPDATE USING (false);



CREATE POLICY "Deny update feedback_responses" ON "public"."feedback_responses" FOR UPDATE USING (false);



CREATE POLICY "anon_read_spolky_events" ON "public"."spolky_events" FOR SELECT TO "anon" USING (true);



CREATE POLICY "auth_delete_spolky_events" ON "public"."spolky_events" FOR DELETE TO "authenticated" USING ((("association_id" = "public"."get_my_association"()) OR ("public"."get_my_role"() = 'reis_admin'::"text")));



CREATE POLICY "auth_insert_spolky_accounts" ON "public"."spolky_accounts" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'reis_admin'::"text"));



CREATE POLICY "auth_insert_spolky_events" ON "public"."spolky_events" FOR INSERT TO "authenticated" WITH CHECK ((("association_id" = "public"."get_my_association"()) OR ("public"."get_my_role"() = 'reis_admin'::"text")));



CREATE POLICY "auth_read_spolky_accounts" ON "public"."spolky_accounts" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR ("public"."get_my_role"() = 'reis_admin'::"text")));



CREATE POLICY "auth_read_spolky_events" ON "public"."spolky_events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "auth_update_spolky_accounts" ON "public"."spolky_accounts" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'reis_admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'reis_admin'::"text"));



CREATE POLICY "auth_update_spolky_events" ON "public"."spolky_events" FOR UPDATE TO "authenticated" USING ((("association_id" = "public"."get_my_association"()) OR ("public"."get_my_role"() = 'reis_admin'::"text"))) WITH CHECK ((("association_id" = "public"."get_my_association"()) OR ("public"."get_my_role"() = 'reis_admin'::"text")));



ALTER TABLE "public"."course_tips" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_active_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."error_resolutions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_map_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feature_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."societies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "societies_admin_insert" ON "public"."societies" FOR INSERT TO "authenticated" WITH CHECK (("public"."get_my_role"() = 'reis_admin'::"text"));



CREATE POLICY "societies_admin_update" ON "public"."societies" FOR UPDATE TO "authenticated" USING (("public"."get_my_role"() = 'reis_admin'::"text")) WITH CHECK (("public"."get_my_role"() = 'reis_admin'::"text"));



-- Roles in prod's stored order (pg_dump printed them reversed, which
-- `db diff` reports as a drop + create of the same policy).
CREATE POLICY "societies_public_read" ON "public"."societies" FOR SELECT TO "anon", "authenticated" USING (true);



ALTER TABLE "public"."spolky_accounts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spolky_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suggestion_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suggestions_rate_log" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_and_log_suggestion"("p_ip_hash" "text", "p_max" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_and_log_suggestion"("p_ip_hash" "text", "p_max" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_and_log_suggestion_bucket"("p_bucket" "text", "p_max" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_and_log_suggestion_bucket"("p_bucket" "text", "p_max" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."compute_fingerprint"("p_error_type" "text", "p_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."compute_fingerprint"("p_error_type" "text", "p_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."compute_fingerprint"("p_error_type" "text", "p_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."compute_fingerprint"("p_error_type" "text", "p_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_course_tip"("p_student_id" "text", "p_course_code" "text", "p_semester_code" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."drop_attachments_when_done"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."drop_attachments_when_done"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."feature_stats"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."feature_stats"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."feature_stats"("p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."feature_stats_unchecked"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."feature_stats_unchecked"("p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_course_tips"("p_course_code" "text", "p_semester_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_course_tips_with_votes"("p_course_code" "text", "p_semester_code" "text", "p_student_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_error_summary"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_error_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_error_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_error_summary"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_event_rsvps"("p_event_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_event_rsvps"("p_event_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."get_event_rsvps"("p_event_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_event_rsvps"("p_event_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_association"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_association"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_association"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_course_tip"("p_student_id" "text", "p_course_code" "text", "p_semester_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_role"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_unique_active_users"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_unique_active_users"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_unique_active_users"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unique_active_users"("p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_usage_stats"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_usage_stats"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_usage_stats"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_usage_stats"("p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_event_map_view"("row_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_event_map_view"("row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_event_map_view"("row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_event_map_view"("row_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_post_click"("row_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_post_click"("row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_post_click"("row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_post_click"("row_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."increment_post_view"("row_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."increment_post_view"("row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_post_view"("row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_post_view"("row_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."prune_suggestion_attachments"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prune_suggestion_attachments"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."resolve_error_cluster"("p_error_type" "text", "p_error_message" "text", "p_file_path" "text", "p_line_number" integer, "p_resolved_in_version" "text", "p_note" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."resolve_error_cluster"("p_error_type" "text", "p_error_message" "text", "p_file_path" "text", "p_line_number" integer, "p_resolved_in_version" "text", "p_note" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_error_cluster"("p_error_type" "text", "p_error_message" "text", "p_file_path" "text", "p_line_number" integer, "p_resolved_in_version" "text", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_error_cluster"("p_error_type" "text", "p_error_message" "text", "p_file_path" "text", "p_line_number" integer, "p_resolved_in_version" "text", "p_note" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_event_rsvp"("p_event_id" "uuid", "p_install_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_event_rsvp"("p_event_id" "uuid", "p_install_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."set_event_rsvp"("p_event_id" "uuid", "p_install_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_event_rsvp"("p_event_id" "uuid", "p_install_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."societies_audience_valid"("p" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."societies_audience_valid"("p" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."societies_audience_valid"("p" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."societies_guard"() TO "anon";
GRANT ALL ON FUNCTION "public"."societies_guard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."societies_guard"() TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_course_tip"("p_student_id" "text", "p_course_code" "text", "p_semester_code" "text", "p_tip_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_feedback"("p_student_id" "text", "p_faculty_id" "text", "p_study_semester" integer, "p_feedback_type" "text", "p_value" "text", "p_semester_code" "text", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_feedback"("p_student_id" "text", "p_faculty_id" "text", "p_study_semester" integer, "p_feedback_type" "text", "p_value" "text", "p_semester_code" "text", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_feedback"("p_student_id" "text", "p_faculty_id" "text", "p_study_semester" integer, "p_feedback_type" "text", "p_value" "text", "p_semester_code" "text", "p_reason" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_suggestion"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_suggestion"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_suggestion"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_suggestion"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_suggestion_v2"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text", "p_diagnostics" "jsonb", "p_screenshot" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_suggestion_v2"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text", "p_diagnostics" "jsonb", "p_screenshot" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_suggestion_v2"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text", "p_diagnostics" "jsonb", "p_screenshot" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_suggestion_v2"("p_type" "text", "p_title" "text", "p_body" "text", "p_screen" "text", "p_contact" "text", "p_ext_version" "text", "p_browser_name" "text", "p_browser_version" "text", "p_viewport" "text", "p_diagnostics" "jsonb", "p_screenshot" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."track_daily_usage"("p_student_id" "text", "p_faculty" "text", "p_platform" "text", "p_programme" "text", "p_app_version" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."track_daily_usage"("p_student_id" "text", "p_faculty" "text", "p_platform" "text", "p_programme" "text", "p_app_version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."track_daily_usage"("p_student_id" "text", "p_faculty" "text", "p_platform" "text", "p_programme" "text", "p_app_version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_daily_usage"("p_student_id" "text", "p_faculty" "text", "p_platform" "text", "p_programme" "text", "p_app_version" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."track_feature_usage"("p_install_id" "text", "p_feature" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."track_feature_usage"("p_install_id" "text", "p_feature" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."track_feature_usage"("p_install_id" "text", "p_feature" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."track_feature_usage"("p_install_id" "text", "p_feature" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_error_group"("p_fingerprint" "text", "p_error_type" "text", "p_normalized" "text", "p_sample_message" "text", "p_ext_version" "text", "p_client_ts" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_error_group"("p_fingerprint" "text", "p_error_type" "text", "p_normalized" "text", "p_sample_message" "text", "p_ext_version" "text", "p_client_ts" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_error_group"("p_fingerprint" "text", "p_error_type" "text", "p_normalized" "text", "p_sample_message" "text", "p_ext_version" "text", "p_client_ts" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_error_group"("p_fingerprint" "text", "p_error_type" "text", "p_normalized" "text", "p_sample_message" "text", "p_ext_version" "text", "p_client_ts" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."usage_programmes"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usage_programmes"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."usage_programmes"("p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."usage_programmes_unchecked"("p_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usage_programmes_unchecked"("p_days" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."usage_retention"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usage_retention"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."usage_retention"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."usage_retention_unchecked"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usage_retention_unchecked"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."usage_stats"("p_days" integer, "p_day" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usage_stats"("p_days" integer, "p_day" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."usage_stats"("p_days" integer, "p_day" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usage_stats_unchecked"("p_days" integer, "p_day" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usage_stats_unchecked"("p_days" integer, "p_day" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."usage_suppress_groups"("p_groups" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."usage_suppress_groups"("p_groups" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."vote_tip_helpful"("p_student_id" "text", "p_tip_id" bigint) TO "service_role";



GRANT ALL ON TABLE "public"."course_tips" TO "anon";
GRANT ALL ON TABLE "public"."course_tips" TO "authenticated";
GRANT ALL ON TABLE "public"."course_tips" TO "service_role";



GRANT ALL ON SEQUENCE "public"."course_tips_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."course_tips_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."course_tips_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."daily_active_usage" TO "anon";
GRANT ALL ON TABLE "public"."daily_active_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."daily_active_usage" TO "service_role";



GRANT ALL ON TABLE "public"."error_resolutions" TO "anon";
GRANT ALL ON TABLE "public"."error_resolutions" TO "authenticated";
GRANT ALL ON TABLE "public"."error_resolutions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."error_resolutions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."error_resolutions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."error_resolutions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."event_map_views" TO "anon";
GRANT ALL ON TABLE "public"."event_map_views" TO "authenticated";
GRANT ALL ON TABLE "public"."event_map_views" TO "service_role";



GRANT ALL ON TABLE "public"."event_rsvps" TO "service_role";



GRANT ALL ON TABLE "public"."feature_usage" TO "anon";
GRANT ALL ON TABLE "public"."feature_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."feature_usage" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_responses" TO "anon";
GRANT ALL ON TABLE "public"."feedback_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_responses" TO "service_role";



GRANT ALL ON TABLE "public"."societies" TO "service_role";
GRANT SELECT ON TABLE "public"."societies" TO "anon";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."societies" TO "authenticated";



GRANT ALL ON TABLE "public"."spolky_accounts" TO "anon";
GRANT ALL ON TABLE "public"."spolky_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."spolky_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."spolky_events" TO "anon";
GRANT ALL ON TABLE "public"."spolky_events" TO "authenticated";
GRANT ALL ON TABLE "public"."spolky_events" TO "service_role";



GRANT ALL ON TABLE "public"."suggestion_attachments" TO "service_role";
GRANT SELECT ON TABLE "public"."suggestion_attachments" TO "authenticated";



GRANT ALL ON TABLE "public"."suggestions" TO "service_role";
GRANT SELECT ON TABLE "public"."suggestions" TO "authenticated";



GRANT UPDATE("status") ON TABLE "public"."suggestions" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."suggestions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."suggestions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."suggestions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."suggestions_rate_log" TO "anon";
GRANT ALL ON TABLE "public"."suggestions_rate_log" TO "authenticated";
GRANT ALL ON TABLE "public"."suggestions_rate_log" TO "service_role";



GRANT ALL ON SEQUENCE "public"."suggestions_rate_log_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."suggestions_rate_log_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."suggestions_rate_log_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";









-- ---------------------------------------------------------------------------
-- Storage: the three public buckets and the policies on storage.objects, as
-- read from prod's storage.buckets and pg_policies on 2026-10-16. The bucket
-- rows are configuration, not student data. (search_path is '' from the
-- dump's header, so everything here is schema-qualified.)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('tutorial-images', 'tutorial-images', true, null, null),
  ('reis-cdn', 'reis-cdn', true, 10485760, array['application/json', 'application/octet-stream']),
  ('society-logos', 'society-logos', true, 262144, array['image/png'])
on conflict (id) do nothing;

create policy "Anyone can view tutorial images" on storage.objects
  for select to public
  using (bucket_id = 'tutorial-images');
create policy "Authenticated users can delete tutorial images" on storage.objects
  for delete to public
  using (bucket_id = 'tutorial-images' and auth.role() = 'authenticated');
create policy "Authenticated users can update tutorial images" on storage.objects
  for update to public
  using (bucket_id = 'tutorial-images' and auth.role() = 'authenticated');
create policy "Authenticated users can upload tutorial images" on storage.objects
  for insert to public
  with check (bucket_id = 'tutorial-images' and auth.role() = 'authenticated');

create policy "society_logos_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');
create policy "society_logos_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');
create policy "society_logos_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin')
  with check (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');
create policy "society_logos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'society-logos' and public.get_my_role() = 'reis_admin');

-- ---------------------------------------------------------------------------
-- pg_cron: report attachments are deleted after 90 days (#435).
-- ---------------------------------------------------------------------------

select cron.schedule(
  'prune-suggestion-attachments',
  '17 3 * * *',
  $$select public.prune_suggestion_attachments()$$
);

-- ---------------------------------------------------------------------------
-- Grants prod does NOT have. A fresh Supabase has default privileges that hand
-- anon and authenticated EXECUTE on every new function and ALL on every new
-- table. pg_dump only writes grants that differ from the owner's default, so
-- the dump above cannot take those away. Without this block a rebuilt
-- database lets anon call the *_unchecked stats functions and holds every
-- table privilege on suggestions (RLS still filters rows, but not TRUNCATE).
-- Derived from supabase/scripts/catalog_fingerprint.sql run
-- against prod and against a build of everything above, 2026-10-16.
-- ---------------------------------------------------------------------------

revoke execute on function public.check_and_log_suggestion(text,integer) from anon, authenticated;
revoke execute on function public.check_and_log_suggestion_bucket(text,integer) from anon, authenticated;
revoke execute on function public.delete_course_tip(text,text,text) from anon, authenticated;
revoke execute on function public.drop_attachments_when_done() from anon, authenticated;
revoke execute on function public.feature_stats(integer) from anon;
revoke execute on function public.feature_stats_unchecked(integer) from anon, authenticated;
revoke execute on function public.get_course_tips(text,text) from anon, authenticated;
revoke execute on function public.get_course_tips_with_votes(text,text,text) from anon, authenticated;
revoke execute on function public.get_my_course_tip(text,text,text) from anon, authenticated;
revoke execute on function public.prune_suggestion_attachments() from anon, authenticated;
revoke execute on function public.submit_course_tip(text,text,text,text) from anon, authenticated;
revoke execute on function public.usage_programmes(integer) from anon;
revoke execute on function public.usage_programmes_unchecked(integer) from anon, authenticated;
revoke execute on function public.usage_retention() from anon;
revoke execute on function public.usage_retention_unchecked() from anon, authenticated;
revoke execute on function public.usage_stats(integer,date) from anon;
revoke execute on function public.usage_stats_unchecked(integer,date) from anon, authenticated;
revoke execute on function public.usage_suppress_groups(jsonb) from anon, authenticated;
revoke execute on function public.vote_tip_helpful(text,bigint) from anon, authenticated;

-- event_rsvps: service_role only.
revoke all on table public.event_rsvps from anon, authenticated;
-- societies: anon reads the catalogue, the console (authenticated) edits it.
revoke all on table public.societies from anon, authenticated;
grant select on table public.societies to anon;
grant select, insert, update on table public.societies to authenticated;
-- suggestions + attachments: the admin console reads them and sets a status.
revoke all on table public.suggestions from anon, authenticated;
revoke all on table public.suggestion_attachments from anon, authenticated;
grant select on table public.suggestions to authenticated;
grant update (status) on table public.suggestions to authenticated;
grant select on table public.suggestion_attachments to authenticated;
