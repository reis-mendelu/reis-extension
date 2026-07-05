-- Removes the policy that exposed every active account's row (incl. email) to any
-- authenticated user. Own-account reads and reis_admin reads remain via the
-- surviving policies (Users read own account / auth_read_spolky_accounts).
DROP POLICY IF EXISTS "auth_read_all_associations_minimal" ON public.spolky_accounts;
