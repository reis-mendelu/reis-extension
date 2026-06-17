-- Fix: iOS/Safari fetches a config-profile URL more than once (preview/preflight
-- fetch, then the real install fetch). The original take_eduroam_transfer burned the
-- row on the FIRST read, so the throwaway fetch consumed the profile and the actual
-- install request got a 404 "already used". Make the read NON-BURNING: it returns the
-- profile for any fetch while the row is unexpired. Security now rests on the short
-- TTL + the password-protected .p12 (the extraction password is never uploaded).
-- pg_cron still purges expired rows; the `consumed` column is left unused.

CREATE OR REPLACE FUNCTION public.take_eduroam_transfer(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payload text;
BEGIN
    SELECT payload INTO v_payload
        FROM public.eduroam_transfers
        WHERE id = p_id AND expires_at > now();
    RETURN v_payload;
END;
$$;
