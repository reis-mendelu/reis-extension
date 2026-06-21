-- Zero-knowledge desktop→phone transfer for the eduroam .mobileconfig pipeline.
-- The desktop encrypts the profile client-side (AES-256-GCM) and uploads ONLY the
-- ciphertext here; the decryption key travels solely in the QR URL fragment and
-- never reaches this server. The row is one-time (burned on first read) and
-- short-lived. RLS is deny-all; access is exclusively through the two
-- SECURITY DEFINER RPCs below (same posture as report_error).

CREATE TABLE IF NOT EXISTS public.eduroam_transfers (
    id          uuid PRIMARY KEY,
    payload     text        NOT NULL,                       -- base64( iv ‖ ciphertext‖tag )
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    consumed    boolean     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS eduroam_transfers_expires_at_idx
    ON public.eduroam_transfers (expires_at);

ALTER TABLE public.eduroam_transfers ENABLE ROW LEVEL SECURITY;
-- No policies: anon cannot read/write rows directly. Only the RPCs below can.

-- Store a ciphertext blob. TTL is clamped to [60s, 900s]; default 480s matches
-- iOS's 8-minute "Profile Downloaded" auto-delete window. Lightly rate-limited.
CREATE OR REPLACE FUNCTION public.put_eduroam_transfer(
    p_id      uuid,
    p_payload text,
    p_ttl_seconds integer DEFAULT 480
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (
        SELECT count(*) FROM public.eduroam_transfers
        WHERE created_at > now() - interval '1 hour'
    ) >= 1000 THEN
        RAISE EXCEPTION 'rate limited';
    END IF;

    IF length(p_payload) > 100000 THEN          -- ~75 KB binary ceiling; profiles are 5–15 KB
        RAISE EXCEPTION 'payload too large';
    END IF;

    INSERT INTO public.eduroam_transfers (id, payload, expires_at)
    VALUES (
        p_id,
        p_payload,
        now() + make_interval(secs => least(greatest(p_ttl_seconds, 60), 900))
    );
END;
$$;

-- Fetch a ciphertext blob ONCE. The UPDATE ... RETURNING atomically burns the row
-- (sets consumed=true) and hands back the payload in a single statement, so two
-- racing readers cannot both succeed. Returns NULL when missing/expired/already read.
CREATE OR REPLACE FUNCTION public.take_eduroam_transfer(p_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_payload text;
BEGIN
    UPDATE public.eduroam_transfers
        SET consumed = true
        WHERE id = p_id AND consumed = false AND expires_at > now()
        RETURNING payload INTO v_payload;
    RETURN v_payload;
END;
$$;

REVOKE ALL ON FUNCTION public.put_eduroam_transfer(uuid, text, integer) FROM public;
REVOKE ALL ON FUNCTION public.take_eduroam_transfer(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.put_eduroam_transfer(uuid, text, integer) TO anon;
GRANT EXECUTE ON FUNCTION public.take_eduroam_transfer(uuid) TO anon;

-- Best-effort purge of expired/consumed rows every 5 minutes when pg_cron exists.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.schedule(
            'purge-eduroam-transfers',
            '*/5 * * * *',
            $cron$ DELETE FROM public.eduroam_transfers
                   WHERE expires_at < now() OR consumed = true; $cron$
        );
    END IF;
END;
$$;
