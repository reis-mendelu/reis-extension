-- Automatic error reporting (PRIVACY.md §6).
-- Stores ONLY the seven fields disclosed in the privacy policy.
-- No user-identifying columns. Anon clients may insert via the report_error
-- RPC; they cannot select, update, or delete.

CREATE TABLE IF NOT EXISTS public.error_reports (
    id              bigserial PRIMARY KEY,
    error_type      text        NOT NULL,
    error_message   text        NOT NULL,
    file_path       text        NOT NULL,
    line_number     integer     NOT NULL,
    ext_version     text        NOT NULL,
    browser_name    text        NOT NULL,
    browser_version text        NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS error_reports_created_at_idx
    ON public.error_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS error_reports_dedupe_idx
    ON public.error_reports (error_type, file_path, line_number);

ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;

-- No policies on the table itself. RLS-on + zero policies = deny-all for
-- anon/authenticated roles. Inserts only happen via the SECURITY DEFINER RPC.

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
    -- Defensive caps so a misbehaving client cannot bloat the table.
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

REVOKE ALL ON FUNCTION public.report_error(text, text, text, integer, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.report_error(text, text, text, integer, text, text, text) TO anon, authenticated;
