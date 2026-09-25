-- Report attachments: a screenshot the student picked and, only if they ticked
-- "Přiložit technické údaje", the cleaned diagnostics they were shown.
--
-- Nothing here is collected in the background. The client sends an attachment
-- only when the student adds it and presses Send; see src/api/suggestions.ts
-- and docs/superpowers/specs/2026-09-25-report-diagnostics-screenshots-design.md.
--
-- STRICTLY ADDITIVE. `submit_suggestion` (v1) and the `suggestions` table are
-- untouched, so a build that has not updated keeps working against this
-- database, and this can be applied before the client that uses it ships.
--
-- Retention: an attachment is deleted 90 days after the report, or as soon as
-- the report is marked `done`, whichever is first. Three mechanisms, because a
-- screenshot of a student's grades is not a row to leave behind by accident:
--   1. pg_cron, daily                      (the guarantee)
--   2. a trigger on suggestions.status     (the "done" half)
--   3. the same prune on every v2 submit   (a backstop if cron is ever off)

-- 1. Table -----------------------------------------------------------------

create table if not exists public.suggestion_attachments (
  suggestion_id     bigint primary key
                    references public.suggestions (id) on delete cascade,
  screenshot        bytea,
  diagnostics       jsonb,
  has_screenshot    boolean generated always as (screenshot is not null) stored,
  diagnostics_count int generated always as (
    case when jsonb_typeof(diagnostics -> 'entries') = 'array'
         then jsonb_array_length(diagnostics -> 'entries') else 0 end
  ) stored,
  created_at        timestamptz not null default now(),

  constraint suggestion_attachments_not_empty
    check (screenshot is not null or diagnostics is not null),
  -- JPEG only (the client re-encodes every image through a canvas, which also
  -- strips EXIF/GPS), and small. `\xffd8ff` is the JPEG SOI + first marker.
  constraint suggestion_attachments_screenshot_jpeg
    check (screenshot is null
           or (octet_length(screenshot) <= 614400
               and substring(screenshot from 1 for 3) = '\xffd8ff'::bytea)),
  constraint suggestion_attachments_diagnostics_shape
    check (diagnostics is null
           or (jsonb_typeof(diagnostics) = 'object'
               and jsonb_typeof(diagnostics -> 'entries') = 'array'
               and jsonb_array_length(diagnostics -> 'entries') <= 50
               and octet_length(diagnostics::text) <= 32768))
);

create index if not exists suggestion_attachments_created_at
  on public.suggestion_attachments (created_at);

alter table public.suggestion_attachments enable row level security;

-- Reads are for reIS admins only, through the same gate as `suggestions`.
drop policy if exists "Admin read suggestion attachments" on public.suggestion_attachments;
create policy "Admin read suggestion attachments" on public.suggestion_attachments
  for select to authenticated
  using (public.get_my_role() = 'reis_admin');

-- Supabase's default privileges hand anon and authenticated full CRUD (and
-- TRUNCATE) on a new public table. Revoke by name — revoking from PUBLIC alone
-- leaves the role-level grants in place — then grant select only.
revoke all on public.suggestion_attachments from public, anon, authenticated;
grant select on public.suggestion_attachments to authenticated;

-- 2. Retention -------------------------------------------------------------

create or replace function public.prune_suggestion_attachments()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.suggestion_attachments
   where created_at < now() - interval '90 days';
$$;

revoke all on function public.prune_suggestion_attachments() from public;
revoke execute on function public.prune_suggestion_attachments() from anon, authenticated;

create or replace function public.drop_attachments_when_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.suggestion_attachments where suggestion_id = new.id;
  return new;
end;
$$;

revoke all on function public.drop_attachments_when_done() from public;
revoke execute on function public.drop_attachments_when_done() from anon, authenticated;

drop trigger if exists suggestions_drop_attachments_when_done on public.suggestions;
create trigger suggestions_drop_attachments_when_done
  after update of status on public.suggestions
  for each row
  when (new.status = 'done' and old.status is distinct from 'done')
  execute function public.drop_attachments_when_done();

create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job where jobname = 'prune-suggestion-attachments';
select cron.schedule(
  'prune-suggestion-attachments',
  '17 3 * * *',
  $$select public.prune_suggestion_attachments()$$
);

-- 3. The write path --------------------------------------------------------
--
-- v1's validation and flood guard, verbatim, then the attachment. The report
-- itself is never lost to its attachment: a refused screenshot or malformed
-- diagnostics are dropped and the text is kept, and the answer says which.
--
-- Returns text rather than boolean:
--   'ok'                     everything stored
--   'ok_without_screenshot'  report (and any diagnostics) stored, image refused
--   'rejected'               validation or flood guard — nothing stored

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

  perform public.prune_suggestion_attachments();

  insert into public.suggestions (
    type, title, body, contact, screen,
    ext_version, browser_name, browser_version, viewport
  ) values (
    p_type, v_title, v_body, v_contact, v_screen,
    left(coalesce(p_ext_version, ''), 20),
    left(coalesce(p_browser_name, ''), 20),
    left(coalesce(p_browser_version, ''), 10),
    left(coalesce(p_viewport, ''), 20)
  ) returning id into v_id;

  -- Screenshot: decode, check, and hold to a GLOBAL budget of 30 an hour. The
  -- flood guard above is per browser|version and allows 100 an hour; at 600 KB
  -- each that is 60 MB an hour from one looping client, so images get their
  -- own, much smaller, allowance.
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

revoke all on function public.submit_suggestion_v2(text, text, text, text, text, text, text, text, text, jsonb, text) from public;
grant execute on function public.submit_suggestion_v2(text, text, text, text, text, text, text, text, text, jsonb, text) to anon, authenticated;
