-- Course Ratings: community course quality signals
-- Students rate courses 1-4 (emoji scale), aggregates visible to all via RPCs

CREATE TABLE course_ratings (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id text NOT NULL,
    course_code text NOT NULL,
    semester_code text NOT NULL,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 4),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (student_id, course_code, semester_code)
);

CREATE INDEX idx_course_ratings_aggregate
    ON course_ratings (course_code, semester_code);

-- RLS enabled, no direct SELECT for anon — all reads go through SECURITY DEFINER RPCs
ALTER TABLE course_ratings ENABLE ROW LEVEL SECURITY;

-- Submit or update a rating (upsert)
CREATE OR REPLACE FUNCTION submit_course_rating(
    p_student_id text,
    p_course_code text,
    p_semester_code text,
    p_rating smallint
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    IF p_rating < 1 OR p_rating > 4 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 4';
    END IF;

    INSERT INTO course_ratings (student_id, course_code, semester_code, rating)
    VALUES (p_student_id, p_course_code, p_semester_code, p_rating)
    ON CONFLICT (student_id, course_code, semester_code)
    DO UPDATE SET rating = EXCLUDED.rating, updated_at = now();
END; $$;

-- Get aggregate ratings for a course in a semester
CREATE OR REPLACE FUNCTION get_course_rating_aggregate(
    p_course_code text,
    p_semester_code text
) RETURNS TABLE (
    total_count bigint,
    avg_rating numeric,
    rating_1 bigint,
    rating_2 bigint,
    rating_3 bigint,
    rating_4 bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        count(*) AS total_count,
        round(avg(rating)::numeric, 2) AS avg_rating,
        count(*) FILTER (WHERE rating = 1) AS rating_1,
        count(*) FILTER (WHERE rating = 2) AS rating_2,
        count(*) FILTER (WHERE rating = 3) AS rating_3,
        count(*) FILTER (WHERE rating = 4) AS rating_4
    FROM course_ratings
    WHERE course_code = p_course_code
    AND semester_code = p_semester_code;
END; $$;

-- Get user's own rating for a course
CREATE OR REPLACE FUNCTION get_my_course_rating(
    p_student_id text,
    p_course_code text,
    p_semester_code text
) RETURNS smallint
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_rating smallint;
BEGIN
    SELECT rating INTO v_rating
    FROM course_ratings
    WHERE student_id = p_student_id
    AND course_code = p_course_code
    AND semester_code = p_semester_code;

    RETURN v_rating;
END; $$;

-- Batch get aggregates for multiple courses (for SubjectsPanel)
CREATE OR REPLACE FUNCTION get_course_ratings_batch(
    p_course_codes text[],
    p_semester_code text
) RETURNS TABLE (
    course_code text,
    total_count bigint,
    avg_rating numeric,
    rating_1 bigint,
    rating_2 bigint,
    rating_3 bigint,
    rating_4 bigint
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        cr.course_code,
        count(*) AS total_count,
        round(avg(cr.rating)::numeric, 2) AS avg_rating,
        count(*) FILTER (WHERE cr.rating = 1) AS rating_1,
        count(*) FILTER (WHERE cr.rating = 2) AS rating_2,
        count(*) FILTER (WHERE cr.rating = 3) AS rating_3,
        count(*) FILTER (WHERE cr.rating = 4) AS rating_4
    FROM course_ratings cr
    WHERE cr.course_code = ANY(p_course_codes)
    AND cr.semester_code = p_semester_code
    GROUP BY cr.course_code;
END; $$;

-- Grant execute to anon
GRANT EXECUTE ON FUNCTION submit_course_rating(text, text, text, smallint) TO anon;
GRANT EXECUTE ON FUNCTION get_course_rating_aggregate(text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_my_course_rating(text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_course_ratings_batch(text[], text) TO anon;
