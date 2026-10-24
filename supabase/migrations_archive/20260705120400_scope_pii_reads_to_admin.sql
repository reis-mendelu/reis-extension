-- Restrict PII reads to reis_admin. Previously any authenticated session could
-- read all feedback (hashed student_id, faculty, NPS, free-text) and daily usage.
DROP POLICY IF EXISTS "Allow authenticated read feedback_responses" ON public.feedback_responses;
CREATE POLICY "Admin read feedback_responses" ON public.feedback_responses
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'reis_admin');

DROP POLICY IF EXISTS "Allow authenticated read daily_active_usage" ON public.daily_active_usage;
CREATE POLICY "Admin read daily_active_usage" ON public.daily_active_usage
  FOR SELECT TO authenticated
  USING (public.get_my_role() = 'reis_admin');
