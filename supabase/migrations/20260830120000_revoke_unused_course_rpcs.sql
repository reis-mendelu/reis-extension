-- Revoke EXECUTE on the course-rating / course-tip RPCs.
--
-- These ten functions are SECURITY DEFINER and executable by `anon`, so anyone
-- holding the publishable key can call them. No client calls any of them: the
-- extension, the admin console (reis-admin) and reis-page were all checked, and
-- the feature they belonged to was never shipped.
--
-- The shared risk is that all ten run as SECURITY DEFINER with no caller
-- identity of their own, so `anon` reaches the tables through them regardless
-- of RLS. What that buys an attacker differs by function:
--
--   * The four write paths (submit_course_rating, submit_course_tip,
--     vote_tip_helpful, delete_course_tip) each take a caller-supplied
--     `p_student_id text` and store or delete rows under it. That is the shape
--     reIS moved away from when SHA-256(studentId) keying was replaced by a
--     random install UUID: an open write keyed on an arbitrary identifier,
--     with nothing tying the identifier to the caller.
--   * Two reads (get_my_course_tip, get_my_course_rating) also take
--     `p_student_id`, so anyone can read back the rows of any identifier they
--     can guess or replay.
--   * The remaining four (get_course_tips, get_course_tips_with_votes,
--     get_course_rating_aggregate, get_course_ratings_batch) expose per-course
--     content and aggregates with no caller scoping at all.
--
-- REVOKE rather than DROP: the four backing tables still hold rows (course_ratings
-- 4, course_tips 1, tip_votes 0), and dropping the functions would strand them
-- with no defined reader. If the feature stays dead, drop functions and tables
-- together in a later migration.
--
-- Both grants must go. Postgres grants EXECUTE to PUBLIC on every new function
-- and PostgREST's `anon` inherits it, so revoking from anon/authenticated alone
-- leaves `=X/postgres` in pg_proc.proacl and the endpoint still answers 200 —
-- verified the hard way. The anon/authenticated revoke ran on 2026-08-30; the
-- PUBLIC half is what actually closes these.
--
-- NOT touched: upsert_subject_rating / get_subject_rating_counts /
-- delete_subject_rating. Those back the live teacher grading pill
-- (src/components/SubjectFileDrawer/Header/TeacherGradingPill.tsx) and are keyed
-- on a per-teacher random vote id, not a student identifier.

REVOKE EXECUTE ON FUNCTION public.submit_course_rating(text, text, text, smallint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_course_tip(text, text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.vote_tip_helpful(text, bigint) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_course_tip(text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_course_tips(text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_course_tips_with_votes(text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_course_tip(text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_course_rating(text, text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_course_rating_aggregate(text, text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_course_ratings_batch(text[], text) FROM anon, authenticated, PUBLIC;
