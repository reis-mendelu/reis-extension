-- Which school a row came from, part 3a: legacy counters and small usage
-- stats count MENDELU only. Overview in 20261117130000_school_columns.sql.

-- 3. Stats count MENDELU only, in place -------------------------------------------
--
-- Each body below is the newest one, verbatim, with `school = 'mendelu'` added
-- where it reads daily_active_usage or feature_usage. Signatures, defaults,
-- language, volatility, SECURITY DEFINER (or not) and search_path are restated
-- exactly; CREATE OR REPLACE keeps owners and grants.

-- get_unique_active_users (baseline): a legacy counter anon can still call; no build since v5.2.5 does.
CREATE OR REPLACE FUNCTION "public"."get_unique_active_users"("p_days" integer) RETURNS integer
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$
    SELECT count(DISTINCT student_id)::integer
    FROM public.daily_active_usage
    WHERE usage_date >= current_date - greatest(p_days, 1)
      AND school = 'mendelu';
$$;

-- get_usage_stats (baseline): the same.
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
                      AND school = 'mendelu'
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
                  AND school = 'mendelu'
                GROUP BY usage_date
            ) t
        )
    );
$$;

-- usage_programmes_unchecked (baseline).
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
       and u.school = 'mendelu'
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

-- usage_retention_unchecked (baseline).
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
       and u.school = 'mendelu'
       -- A device only counts once IS has named a student on it (the app
       -- gates new writes on that since this change; see the header).
       and u.student_id in (select v.student_id from public.daily_active_usage v
                             where v.faculty is not null and v.school = 'mendelu')
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

-- usage_stats_unchecked (baseline).
