-- Tip helpfulness votes: one thumbs-up per student per tip (toggle)

CREATE TABLE tip_votes (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tip_id bigint NOT NULL REFERENCES course_tips(id) ON DELETE CASCADE,
    student_id text NOT NULL,
    created_at timestamptz DEFAULT now(),
    UNIQUE (tip_id, student_id)
);

CREATE INDEX idx_tip_votes_tip ON tip_votes (tip_id);

ALTER TABLE tip_votes ENABLE ROW LEVEL SECURITY;

-- Toggle vote: insert if not exists, delete if exists
CREATE OR REPLACE FUNCTION vote_tip_helpful(
    p_student_id text,
    p_tip_id bigint
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Replaces get_course_tips — includes vote counts and user's own vote status
CREATE OR REPLACE FUNCTION get_course_tips_with_votes(
    p_course_code text,
    p_semester_code text,
    p_student_id text
) RETURNS TABLE (
    tip_id bigint,
    tip_text text,
    created_at timestamptz,
    helpful_count bigint,
    voted_by_me boolean
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
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

-- Grant execute to anon
GRANT EXECUTE ON FUNCTION vote_tip_helpful(text, bigint) TO anon;
GRANT EXECUTE ON FUNCTION get_course_tips_with_votes(text, text, text) TO anon;
