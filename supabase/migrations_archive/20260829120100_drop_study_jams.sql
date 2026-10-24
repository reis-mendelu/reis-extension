-- StudyJams is removed from the codebase — nothing referenced it — so its
-- backend goes with it.
--
-- Four of these RPCs took a RAW `p_student_id text`: an unhashed IS student id
-- travelling to Supabase, which is exactly what reIS promises never happens.
-- That alone justified removing them rather than leaving them dormant.
--
-- Verified empty before dropping: study_jam_availability, study_jam_dismissals
-- and tutoring_matches held 0 rows; killer_courses held 2 inactive config rows
-- (EBC-MT Matematika, EBC-ST Statistika) and no student data.

DROP FUNCTION IF EXISTS public.register_study_jam_availability(text, text, text);
DROP FUNCTION IF EXISTS public.delete_study_jam_availability(text, text);
DROP FUNCTION IF EXISTS public.dismiss_study_jam_suggestion(text, text);
DROP FUNCTION IF EXISTS public.withdraw_study_jam_match(text, text);
DROP FUNCTION IF EXISTS public.match_study_jam(text);

DROP TABLE IF EXISTS public.study_jam_availability;
DROP TABLE IF EXISTS public.study_jam_dismissals;
DROP TABLE IF EXISTS public.tutoring_matches;
DROP TABLE IF EXISTS public.killer_courses;
