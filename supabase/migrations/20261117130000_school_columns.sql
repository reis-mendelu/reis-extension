-- Which school a row came from (the "send-only" step for other UIS schools;
-- research/multi-school-supabase.md §7 step 1). reIS is being prepared for
-- universities on the same IS software, VŠE first. Before any of them sends a
-- row, the database has to be able to tell a MENDELU row from theirs, and every
-- figure shown about MENDELU has to stay MENDELU's.
--
-- Five files, applied in order: this one (1), _school_writers (2), and
-- _school_legacy_stats, _school_usage_stats, _school_feature_stats (3).
--
-- 1. A `school` column on daily_active_usage, feature_usage and suggestions:
--    not null, default 'mendelu', one of the known ids. Every row written so far,
--    and every row a released build writes from now on, is MENDELU's, and the
--    default records exactly that.
--
-- 2. Three NEW functions that take the school: track_daily_usage_v2,
--    track_feature_usage_v2 and submit_suggestion_v4. New names, never a new
--    defaulted parameter on the old ones: PostgreSQL would keep both overloads,
--    and the named-argument call a released build makes would then match two
--    functions and fail with "could not choose the best candidate function".
--    The old functions are untouched and keep their grants, so released builds
--    go on calling them and their rows land as 'mendelu' through the default.
--    The school is required and checked: a missing or unknown id stores nothing
--    rather than falling back to 'mendelu', which would put another school's
--    rows into MENDELU's figures.
--
--    For a school other than MENDELU, faculty and programme are stored as null.
--    VŠE's header does not parse into them today, the faculty whitelist and the
--    table CHECK know MENDELU's faculties only (and ČZU has a PEF of its own),
--    and school + platform + app version is the tightest label set to start
--    with. Accepting them is a later, separate step.
--
-- 3. The admin and stats functions count MENDELU only, in place: same
--    signatures, same attributes, same JSON shape, and CREATE OR REPLACE keeps
--    their owners and grants, so consoles already released show correct numbers
--    without an update. Only the telemetry tables are filtered here; the
--    content tables (posts, map views, questions) get a school in a later step,
--    and every row in them is MENDELU's until then.
--
-- Additive for every released build: three columns with a default, a CHECK on
-- each that every existing row passes, three new functions, and filters that
-- change nothing while every row is 'mendelu'. Nothing new is collected from MENDELU
-- students; a school label is the same on every install of it.

-- 1. Columns ---------------------------------------------------------------------

alter table public.daily_active_usage
  add column if not exists school text not null default 'mendelu';
alter table public.daily_active_usage
  drop constraint if exists daily_active_usage_school_check,
  add constraint daily_active_usage_school_check check (school in ('mendelu', 'vse', 'czu'));

alter table public.feature_usage
  add column if not exists school text not null default 'mendelu';
alter table public.feature_usage
  drop constraint if exists feature_usage_school_check,
  add constraint feature_usage_school_check check (school in ('mendelu', 'vse', 'czu'));

alter table public.suggestions
  add column if not exists school text not null default 'mendelu';
alter table public.suggestions
  drop constraint if exists suggestions_school_check,
  add constraint suggestions_school_check check (school in ('mendelu', 'vse', 'czu'));
