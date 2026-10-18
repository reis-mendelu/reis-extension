-- Two changes to the report form's server side, both safe for every released
-- build (docs/database-migrations.md: additive, nothing a client calls changes).
--
-- 1. Context. A report now says which platform and OS it was SENT from
--    (`ios`/`android`/`extension`, and e.g. `iOS 18`; no device model), in two
--    new columns on `suggestions`. A new function, `submit_suggestion_v3`,
--    carries them. v2 stays callable under the same signature for builds that
--    have not updated; it now just forwards to v3 with empty labels, so there is
--    one implementation of the validation and the flood guard.
--
-- 2. Attachments are kept (Dominik, 18 Oct 2026). A screenshot or technical log
--    a student chose to send is no longer deleted after 90 days or when the
--    report is marked `done`. This removes the daily pg_cron job, the status
--    trigger, and the prune the v2 write path ran on every submit. Nothing
--    existing is affected retroactively: prod suggestion_attachments was empty
--    when this was written. Student-facing wording changed in the same PR
--    (PRIVACY.md, docs/privacy-policy-app.md, privacy/disclosures.ts).
--    Access is unchanged: reis_admin read only, deny-all RLS otherwise.

-- 1. Context columns ---------------------------------------------------------

alter table public.suggestions
  add column if not exists platform   text not null default '',
  add column if not exists os_version text not null default '';

alter table public.suggestions
  drop constraint if exists suggestions_platform_check,
  drop constraint if exists suggestions_os_version_check,
  add constraint suggestions_platform_check   check (char_length(platform) <= 20),
  add constraint suggestions_os_version_check check (char_length(os_version) <= 40);

-- 2. Write path ----------------------------------------------------------------
--
-- v2's body, verbatim, minus the prune call, plus the two labels. Same answers:
--   'ok' | 'ok_without_screenshot' | 'rejected'

create or replace function public.submit_suggestion_v3(
  p_type            text,
  p_title           text,
  p_body            text,
  p_screen          text,
  p_contact         text  default null,
  p_ext_version     text  default '',
  p_browser_name    text  default '',
  p_browser_version text  default '',
  p_viewport        text  default '',
  p_diagnostics     jsonb default null,
  p_screenshot      text  default null,
  p_platform        text  default '',
  p_os_version      text  default ''
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title      text := btrim(coalesce(p_title, ''));
  v_body       text := btrim(coalesce(p_body, ''));
  v_contact    text := nullif(btrim(coalesce(p_contact, '')), '');
  v_screen     text := btrim(coalesce(p_screen, ''));
  v_id         bigint;
  v_shot       bytea;
  v_diag       jsonb := p_diagnostics;
  v_shot_lost  boolean := false;
  v_recent     int;
begin
  if p_type is null or p_type not in ('bug', 'idea', 'other') then
    return 'rejected';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 120 then
    return 'rejected';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return 'rejected';
  end if;
  if v_contact is not null and char_length(v_contact) > 120 then
    return 'rejected';
  end if;
  if char_length(v_screen) < 1 or char_length(v_screen) > 40 then
    return 'rejected';
  end if;

  if not public.check_and_log_suggestion_bucket(
    coalesce(nullif(btrim(p_browser_name), ''), 'unknown') || '|' ||
    coalesce(nullif(btrim(p_browser_version), ''), 'unknown')
  ) then
    return 'rejected';
  end if;

  insert into public.suggestions (
    type, title, body, contact, screen,
    ext_version, browser_name, browser_version, viewport,
    platform, os_version
  ) values (
    p_type, v_title, v_body, v_contact, v_screen,
    left(coalesce(p_ext_version, ''), 20),
    left(coalesce(p_browser_name, ''), 20),
    left(coalesce(p_browser_version, ''), 10),
    left(coalesce(p_viewport, ''), 20),
    left(btrim(coalesce(p_platform, '')), 20),
    left(btrim(coalesce(p_os_version, '')), 40)
  ) returning id into v_id;

  -- Screenshot: decode, check, and hold to a GLOBAL budget of 30 an hour. The
  -- flood guard above is per browser|version and allows 100 an hour; at 600 KB
  -- each that is 60 MB an hour from one looping client, so images get their
  -- own, much smaller, allowance. It matters more now that they are kept.
  if p_screenshot is not null then
    begin
      v_shot := decode(p_screenshot, 'base64');
    exception when others then
      v_shot := null;
    end;
    if v_shot is null
       or octet_length(v_shot) > 614400
       or substring(v_shot from 1 for 3) <> '\xffd8ff'::bytea then
      v_shot := null;
    else
      perform pg_advisory_xact_lock(hashtext('suggestion_attachments.screenshot_budget'));
      select count(*) into v_recent
        from public.suggestion_attachments
       where has_screenshot and created_at > now() - interval '1 hour';
      if v_recent >= 30 then
        v_shot := null;
      end if;
    end if;
    v_shot_lost := v_shot is null;
  end if;

  if v_diag is not null and not (
       jsonb_typeof(v_diag) = 'object'
       and jsonb_typeof(v_diag -> 'entries') = 'array'
       and jsonb_array_length(v_diag -> 'entries') <= 50
       and octet_length(v_diag::text) <= 32768) then
    v_diag := null;
  end if;

  if v_shot is not null or v_diag is not null then
    insert into public.suggestion_attachments (suggestion_id, screenshot, diagnostics)
    values (v_id, v_shot, v_diag);
  end if;

  return case when v_shot_lost then 'ok_without_screenshot' else 'ok' end;
end;
$$;

revoke all on function public.submit_suggestion_v3(text, text, text, text, text, text, text, text, text, jsonb, text, text, text) from public;
grant execute on function public.submit_suggestion_v3(text, text, text, text, text, text, text, text, text, jsonb, text, text, text) to anon, authenticated;

-- v2: same signature, same grants (CREATE OR REPLACE keeps them), same answers.
create or replace function public.submit_suggestion_v2(
  p_type            text,
  p_title           text,
  p_body            text,
  p_screen          text,
  p_contact         text  default null,
  p_ext_version     text  default '',
  p_browser_name    text  default '',
  p_browser_version text  default '',
  p_viewport        text  default '',
  p_diagnostics     jsonb default null,
  p_screenshot      text  default null
) returns text
language sql
security definer
set search_path = public
as $$
  select public.submit_suggestion_v3(
    p_type, p_title, p_body, p_screen, p_contact, p_ext_version,
    p_browser_name, p_browser_version, p_viewport, p_diagnostics, p_screenshot
  );
$$;

-- 3. Retention: gone ---------------------------------------------------------
--
-- The cron job first, then the trigger, then the functions they ran. The v2
-- write path no longer calls the prune, so dropping it breaks nothing; neither
-- function was ever executable by anon or authenticated.

select cron.unschedule(jobid) from cron.job where jobname = 'prune-suggestion-attachments';

drop trigger if exists suggestions_drop_attachments_when_done on public.suggestions;
drop function if exists public.drop_attachments_when_done();
drop function if exists public.prune_suggestion_attachments();
