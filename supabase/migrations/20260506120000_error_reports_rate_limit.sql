-- Server-side rate limit for the error reporter (PRIVACY.md §6).
-- Replaces the original report_error function with a version that aborts
-- if more than 500 rows have been inserted in the last hour.
-- 69 MAU × 5 session cap ≈ 345 max in a realistic burst; 500 gives headroom.
-- The count query uses the error_reports_created_at_idx (index scan, not seq scan).

CREATE OR REPLACE FUNCTION public.report_error(
    p_error_type      text,
    p_error_message   text,
    p_file_path       text,
    p_line_number     integer,
    p_ext_version     text,
    p_browser_name    text,
    p_browser_version text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (
        SELECT count(*) FROM public.error_reports
        WHERE created_at > now() - interval '1 hour'
    ) >= 500 THEN
        RETURN;
    END IF;

    INSERT INTO public.error_reports (
        error_type, error_message, file_path, line_number,
        ext_version, browser_name, browser_version
    ) VALUES (
        left(p_error_type, 100),
        left(p_error_message, 500),
        left(p_file_path, 500),
        p_line_number,
        left(p_ext_version, 32),
        left(p_browser_name, 32),
        left(p_browser_version, 32)
    );
END;
$$;
