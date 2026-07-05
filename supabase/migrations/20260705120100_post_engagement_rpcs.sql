-- Engagement counters for the unified spolky_events "post". Replaces the
-- notifications-targeted increment_notification_* RPCs (dropped in a later
-- migration). search_path is pinned empty per SECURITY DEFINER best practice.
CREATE OR REPLACE FUNCTION public.increment_post_view(row_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.spolky_events SET view_count = view_count + 1 WHERE id = row_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_post_click(row_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  UPDATE public.spolky_events SET click_count = click_count + 1 WHERE id = row_id;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_post_view(uuid)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_post_click(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_post_view(uuid)  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_post_click(uuid) TO anon, authenticated;
