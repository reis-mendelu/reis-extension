-- Feedback moves from the `submit-suggestion` edge function to a SECURITY
-- DEFINER RPC callable with the publishable key — the same shape telemetry
-- already uses (report_error_v2). This lets us delete the edge function and
-- EXTENSION_SECRET outright.
--
-- Why the secret was never security: it shipped inside the extension bundle,
-- so anyone could unzip it and read the value. A string that every client
-- carries is an identifier, not a credential. It existed to gate the AI
-- proxies (where it was wrongly the only thing guarding spend) and
-- submit-suggestion inherited it by copy. On a write-only insert it protected
-- nothing.
--
-- Authorization is unchanged and still server-side: `suggestions` stays at
-- deny-all RLS with no insert grant to anon, so the ONLY way to write a row is
-- through this function. Reads and status updates remain reis_admin-only.

-- 1. The rate bucket is no longer an IP hash --------------------------------
--
-- Postgres cannot see the caller's IP; only an edge function could. So the
-- per-IP cap is genuinely lost, and pretending otherwise by keeping the column
-- name would be a lie. Renamed to `bucket`, and the cap becomes a coarse
-- FLOOD GUARD (protecting the table from a looping client), NOT per-user
-- security. This is the deliberate tradeoff for removing the secret: spam is
-- acceptable for now and Turnstile is the escalation if it ever appears.

alter table public.suggestions_rate_log rename column ip_hash to bucket;
alter index if exists suggestions_rate_log_hash_time rename to suggestions_rate_log_bucket_time;

drop function if exists public.check_and_log_suggestion(text, int);

create or replace function public.check_and_log_suggestion(
  p_bucket text,
  p_max int default 100
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  -- Serialize concurrent submissions in the same bucket so check-then-insert
  -- cannot race (TOCTOU). Released at commit.
  perform pg_advisory_xact_lock(hashtext(p_bucket));

  delete from public.suggestions_rate_log
   where created_at < now() - interval '1 hour';

  select count(*) into recent
    from public.suggestions_rate_log
   where bucket = p_bucket
     and created_at > now() - interval '1 hour';

  if recent >= p_max then
    return false;
  end if;

  insert into public.suggestions_rate_log (bucket) values (p_bucket);
  return true;
end;
$$;

revoke all on function public.check_and_log_suggestion(text, int) from public;
-- Not granted to anon: only the SECURITY DEFINER submit_suggestion below calls it.
grant execute on function public.check_and_log_suggestion(text, int) to service_role;

-- 2. The write path ---------------------------------------------------------
--
-- Validation is duplicated from the edge function on purpose: the table's CHECK
-- constraints would reject bad input anyway, but as a raised exception rather
-- than a clean result, and over-limit text must be REJECTED rather than
-- silently truncated — truncating loses what the student wrote while telling
-- them it was accepted.

create or replace function public.submit_suggestion(
  p_type            text,
  p_title           text,
  p_body            text,
  p_screen          text,
  p_contact         text default null,
  p_ext_version     text default '',
  p_browser_name    text default '',
  p_browser_version text default '',
  p_viewport        text default ''
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title   text := btrim(coalesce(p_title, ''));
  v_body    text := btrim(coalesce(p_body, ''));
  v_contact text := nullif(btrim(coalesce(p_contact, '')), '');
  v_screen  text := btrim(coalesce(p_screen, ''));
begin
  if p_type is null or p_type not in ('bug', 'idea', 'other') then
    return false;
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    return false;
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return false;
  end if;
  if v_contact is not null and char_length(v_contact) > 120 then
    return false;
  end if;
  if char_length(v_screen) < 1 or char_length(v_screen) > 40 then
    return false;
  end if;

  -- Coarse flood guard; see the note above on why this is not per-user.
  if not public.check_and_log_suggestion(
    coalesce(nullif(btrim(p_browser_name), ''), 'unknown') || '|' ||
    coalesce(nullif(btrim(p_browser_version), ''), 'unknown')
  ) then
    return false;
  end if;

  insert into public.suggestions (
    type, title, body, contact, screen,
    ext_version, browser_name, browser_version, viewport
  ) values (
    p_type, v_title, v_body, v_contact, v_screen,
    left(coalesce(p_ext_version, ''), 20),
    left(coalesce(p_browser_name, ''), 20),
    left(coalesce(p_browser_version, ''), 10),
    left(coalesce(p_viewport, ''), 20)
  );

  return true;
end;
$$;

revoke all on function public.submit_suggestion(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_suggestion(text, text, text, text, text, text, text, text, text) to anon, authenticated;
