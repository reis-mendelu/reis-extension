-- Prune window now matches the counting window. Rows older than one hour can
-- never affect the rate-limit decision, so retaining 24h of salted IP hashes
-- served no purpose and contradicted the stated privacy rationale.
--
-- 20260803120000_suggestions.sql was corrected in place before release, so on a
-- fresh database this migration is a no-op re-definition. It exists because the
-- 24h version had already been applied to the live project and the remote
-- migration history must match the files in this directory.
create or replace function public.check_and_log_suggestion(
  p_ip_hash text,
  p_max int default 5
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  -- Serialize concurrent submissions from the same source so check-then-insert
  -- cannot race (TOCTOU): two parallel requests could otherwise both read the
  -- old count and both insert, bypassing the cap. Released at commit.
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));

  -- Prune. This table must not become a growing record of who submitted from
  -- where; one hour of history is all the cap needs.
  delete from public.suggestions_rate_log
   where created_at < now() - interval '1 hour';

  select count(*) into recent
    from public.suggestions_rate_log
   where ip_hash = p_ip_hash
     and created_at > now() - interval '1 hour';

  if recent >= p_max then
    return false;
  end if;

  insert into public.suggestions_rate_log (ip_hash) values (p_ip_hash);
  return true;
end;
$$;

revoke all on function public.check_and_log_suggestion(text, int) from public;
grant execute on function public.check_and_log_suggestion(text, int) to service_role;
