-- StudyJams Security: revoke direct anon writes, move mutations behind SECURITY DEFINER RPCs
-- Also removes semester_id from all study_jam tables (redundant — active semester is implicit via killer_courses.is_active)

-- 1. Drop ALL existing anon write policies on study_jam tables
DROP POLICY IF EXISTS "allow anon insert on availability" ON study_jam_availability;
DROP POLICY IF EXISTS "anon_insert" ON study_jam_availability;
DROP POLICY IF EXISTS "anon_insert_availability" ON study_jam_availability;
DROP POLICY IF EXISTS "allow anon delete own availability" ON study_jam_availability;
DROP POLICY IF EXISTS "anon_delete" ON study_jam_availability;
DROP POLICY IF EXISTS "anon_insert_dismissal" ON study_jam_dismissals;
DROP POLICY IF EXISTS "anon insert" ON tutoring_matches;

-- Drop existing read policies to replace them
DROP POLICY IF EXISTS "anon_read_all" ON study_jam_availability;
DROP POLICY IF EXISTS "anon_read_tutors" ON study_jam_availability;
DROP POLICY IF EXISTS "anon_read_dismissals" ON study_jam_dismissals;
DROP POLICY IF EXISTS "anon select own" ON tutoring_matches;

-- 2. Remove semester_id from all tables

-- study_jam_availability: drop old unique constraint, drop column, add new constraint
ALTER TABLE study_jam_availability DROP CONSTRAINT IF EXISTS study_jam_availability_student_id_course_code_semester_id_key;
ALTER TABLE study_jam_availability DROP COLUMN IF EXISTS semester_id;
DO $$ BEGIN
  ALTER TABLE study_jam_availability ADD CONSTRAINT study_jam_availability_student_id_course_code_key UNIQUE (student_id, course_code);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- study_jam_dismissals: drop old unique constraint, drop column, add new constraint
ALTER TABLE study_jam_dismissals DROP CONSTRAINT IF EXISTS study_jam_dismissals_student_id_course_code_semester_id_key;
ALTER TABLE study_jam_dismissals DROP COLUMN IF EXISTS semester_id;
DO $$ BEGIN
  ALTER TABLE study_jam_dismissals ADD CONSTRAINT study_jam_dismissals_student_id_course_code_key UNIQUE (student_id, course_code);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- tutoring_matches: just drop the column
ALTER TABLE tutoring_matches DROP COLUMN IF EXISTS semester_id;

-- 3. New scoped read policies (open reads since we can't scope without auth)
DROP POLICY IF EXISTS "anon_read_own_availability" ON study_jam_availability;
CREATE POLICY "anon_read_own_availability" ON study_jam_availability
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_own_dismissals" ON study_jam_dismissals;
CREATE POLICY "anon_read_own_dismissals" ON study_jam_dismissals
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_own_matches" ON tutoring_matches;
CREATE POLICY "anon_read_own_matches" ON tutoring_matches
  FOR SELECT TO anon USING (true);

-- 4. Update match_study_jam to stop referencing semester_id
CREATE OR REPLACE FUNCTION match_study_jam(p_course_code text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tutor RECORD;
  v_tutee RECORD;
BEGIN
  SELECT * INTO v_tutor
  FROM study_jam_availability
  WHERE course_code = p_course_code AND role = 'tutor'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  SELECT * INTO v_tutee
  FROM study_jam_availability
  WHERE course_code = p_course_code AND role = 'tutee'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_tutor IS NOT NULL AND v_tutee IS NOT NULL THEN
    INSERT INTO tutoring_matches (tutor_student_id, tutee_student_id, course_code)
    VALUES (v_tutor.student_id, v_tutee.student_id, p_course_code);

    DELETE FROM study_jam_availability WHERE id = v_tutor.id;
    DELETE FROM study_jam_availability WHERE id = v_tutee.id;
  END IF;
END; $$;

-- 6. Drop old RPC versions (signature changed — must drop before recreating)
DROP FUNCTION IF EXISTS register_study_jam_availability(text, text, text, text);
DROP FUNCTION IF EXISTS dismiss_study_jam_suggestion(text, text, text);

-- 7. SECURITY DEFINER RPCs for all writes

CREATE OR REPLACE FUNCTION register_study_jam_availability(
  p_student_id text,
  p_course_code text,
  p_role text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_role NOT IN ('tutor', 'tutee') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM killer_courses
    WHERE course_code = p_course_code AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Course not eligible';
  END IF;

  IF EXISTS (
    SELECT 1 FROM tutoring_matches
    WHERE course_code = p_course_code
    AND (tutor_student_id = p_student_id OR tutee_student_id = p_student_id)
  ) THEN
    RAISE EXCEPTION 'Already matched for this course';
  END IF;

  INSERT INTO study_jam_availability (student_id, course_code, role)
  VALUES (p_student_id, p_course_code, p_role)
  ON CONFLICT (student_id, course_code)
  DO UPDATE SET role = EXCLUDED.role;

  PERFORM match_study_jam(p_course_code);
END; $$;

CREATE OR REPLACE FUNCTION delete_study_jam_availability(
  p_student_id text,
  p_course_code text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM study_jam_availability
  WHERE student_id = p_student_id AND course_code = p_course_code;
END; $$;

CREATE OR REPLACE FUNCTION dismiss_study_jam_suggestion(
  p_student_id text,
  p_course_code text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO study_jam_dismissals (student_id, course_code)
  VALUES (p_student_id, p_course_code)
  ON CONFLICT (student_id, course_code) DO NOTHING;
END; $$;

CREATE OR REPLACE FUNCTION withdraw_study_jam_match(
  p_student_id text,
  p_course_code text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM tutoring_matches
  WHERE course_code = p_course_code
  AND (tutor_student_id = p_student_id OR tutee_student_id = p_student_id);

  DELETE FROM study_jam_availability
  WHERE student_id = p_student_id AND course_code = p_course_code;
END; $$;

-- 8. Grant RPC execute to anon
GRANT EXECUTE ON FUNCTION register_study_jam_availability(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION delete_study_jam_availability(text, text) TO anon;
GRANT EXECUTE ON FUNCTION dismiss_study_jam_suggestion(text, text) TO anon;
GRANT EXECUTE ON FUNCTION withdraw_study_jam_match(text, text) TO anon;
