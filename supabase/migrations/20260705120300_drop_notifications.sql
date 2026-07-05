-- notifications is superseded by the unified spolky_events "post" model, and
-- carried a broken always-true INSERT policy. Never a production-active feature,
-- so no data preservation is required. Dropping the table also removes that hole.
DROP FUNCTION IF EXISTS public.increment_notification_view(uuid);
DROP FUNCTION IF EXISTS public.increment_notification_click(uuid);
DROP TABLE IF EXISTS public.notifications CASCADE;
