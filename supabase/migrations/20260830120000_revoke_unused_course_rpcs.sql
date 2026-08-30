-- Revoke EXECUTE on the course-rating / course-tip RPCs.
--
-- These ten functions are SECURITY DEFINER and executable by `anon`, so anyone
-- holding the publishable key can call them. No client calls any of them: the
-- extension, the admin console (reis-admin) and reis-page were all checked, and
-- the feature they belonged to was never shipped.
--
-- Each one takes a caller-supplied `p_student_id text` and writes it straight
-- into a table, which is the shape reIS specifically moved away from when the
-- SHA-256(studentId) keying was replaced by a random install UUID. Leaving them
-- reachable means an open write path keyed on an arbitrary identifier.
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
