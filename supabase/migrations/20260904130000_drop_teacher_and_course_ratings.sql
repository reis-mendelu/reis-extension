-- Remove the rating features. reIS is not in the business of grading teachers.
--
-- Three abandoned things, taken together because they are the same idea:
--   subject_ratings — the teacher grading pill. 16 rows, last written 2026-05-29.
--   course_ratings  — an earlier course-rating attempt. 4 rows, last 2026-03-29.
--   tip_votes       — never used. 0 rows.
--
-- The client no longer calls any of these; the pill and its per-teacher vote id
-- are deleted in the same change. Released builds keep calling until they
-- update, and those calls fail into logError, which is console-only.
--
-- Functions first, then tables, so nothing can insert into a table on its way
-- out.

drop function if exists public.upsert_subject_rating(text, text, int);
drop function if exists public.delete_subject_rating(text, text);
drop function if exists public.get_subject_rating_counts(text);
drop function if exists public.submit_course_rating(text, text, int);
drop function if exists public.get_my_course_rating(text, text);
drop function if exists public.get_course_rating_aggregate(text);
drop function if exists public.get_course_ratings_batch(text[]);

-- Any overload the signatures above did not name.
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
      from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in (
         'upsert_subject_rating', 'delete_subject_rating', 'get_subject_rating_counts',
         'submit_course_rating', 'get_my_course_rating',
         'get_course_rating_aggregate', 'get_course_ratings_batch'
       )
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

drop table if exists public.subject_ratings;
drop table if exists public.course_ratings;
drop table if exists public.tip_votes;
