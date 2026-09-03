-- `revoke ... from public` does NOT take EXECUTE away from `anon`.
--
-- Supabase's project bootstrap grants EXECUTE on functions in `public` to
-- `anon` and `authenticated` directly, not via the PUBLIC pseudo-role. A
-- `revoke ... from public` therefore removes a grant those roles were never
-- relying on, and the role-level grant survives untouched — so a helper the
-- previous migrations describe as internal ("Not granted to anon: only the
-- SECURITY DEFINER function below calls it") was in fact callable straight
-- from the publishable key.
--
-- Verified against production on 2026-09-03 via pg_proc/has_function_privilege:
-- both helpers below reported anon EXECUTE = true despite the revoke-from-public
-- lines. This migration is the repo catching up with the fix applied by hand
-- there, so `supabase db reset` reproduces production rather than drifting back.
--
-- Impact was low — the helpers only stamp a rate-limit bucket, they write no
-- student data — but the intent and the reality disagreed, which is the part
-- worth closing. The entry points keep their grants: `submit_suggestion` stays
-- anon-callable, and that is the only door.
--
-- Idempotent: revoking a grant that is already gone is a no-op.

revoke execute on function public.check_and_log_suggestion_bucket(text, int)
  from anon, authenticated;

-- Still called by the deployed `submit-suggestion` edge function (service_role)
-- until every released client has moved to the RPC, so the function itself
-- stays; only the anon door closes.
revoke execute on function public.check_and_log_suggestion(text, int)
  from anon, authenticated;
