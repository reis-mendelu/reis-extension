-- Course Tips: anonymous one-liner advice from students
-- Extends course ratings — students can leave an optional tip after rating

CREATE TABLE course_tips (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id text NOT NULL,
    course_code text NOT NULL,
    semester_code text NOT NULL,
    tip_text text NOT NULL CHECK (char_length(tip_text) BETWEEN 3 AND 140),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (student_id, course_code, semester_code)
);

CREATE INDEX idx_course_tips_lookup ON course_tips (course_code, semester_code);

ALTER TABLE course_tips ENABLE ROW LEVEL SECURITY;

-- Upsert a tip (one per student/course/semester)
CREATE OR REPLACE FUNCTION submit_course_tip(
    p_student_id text,
    p_course_code text,
    p_semester_code text,
    p_tip_text text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF char_length(p_tip_text) < 3 OR char_length(p_tip_text) > 140 THEN
        RAISE EXCEPTION 'Tip must be between 3 and 140 characters';
    END IF;

    INSERT INTO course_tips (student_id, course_code, semester_code, tip_text)
    VALUES (p_student_id, p_course_code, p_semester_code, p_tip_text)
    ON CONFLICT (student_id, course_code, semester_code)
    DO UPDATE SET tip_text = EXCLUDED.tip_text, updated_at = now();
END; $$;

-- Get all tips for a course (anonymous — no student_id returned)
CREATE OR REPLACE FUNCTION get_course_tips(
    p_course_code text,
    p_semester_code text
) RETURNS TABLE (
    tip_text text,
    created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT ct.tip_text, ct.created_at
    FROM course_tips ct
    WHERE ct.course_code = p_course_code
    AND ct.semester_code = p_semester_code
    ORDER BY ct.created_at DESC
    LIMIT 20;
END; $$;

-- Get user's own tip for a course
CREATE OR REPLACE FUNCTION get_my_course_tip(
    p_student_id text,
    p_course_code text,
    p_semester_code text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Delete user's own tip
CREATE OR REPLACE FUNCTION delete_course_tip(
    p_student_id text,
    p_course_code text,
    p_semester_code text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM course_tips
    WHERE student_id = p_student_id
    AND course_code = p_course_code
    AND semester_code = p_semester_code;
END; $$;

-- Grant execute to anon
GRANT EXECUTE ON FUNCTION submit_course_tip(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_course_tips(text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_my_course_tip(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION delete_course_tip(text, text, text) TO anon;
