-- Free-text student suggestions, replacing the client-side Discord webhook
-- (issue #163). Distinct from feedback_responses (per-semester NPS/subject
-- ratings) and from the student-facing society feed.

create table if not exists public.suggestions (
  id              bigint generated always as identity primary key,
  type            text not null check (type in ('bug','idea','other')),
  title           text not null check (char_length(title) between 1 and 120),
  body            text not null check (char_length(body) between 1 and 2000),
  contact         text          check (char_length(contact) <= 120),
  screen          text not null check (char_length(screen) <= 40),
  ext_version     text not null default '',
  browser_name    text not null default '',
  browser_version text not null default '',
  viewport        text not null default '',
  status          text not null default 'new' check (status in ('new','triaged','done')),
  created_at      timestamptz not null default now()
);

alter table public.suggestions enable row level security;

create index if not exists suggestions_status_time
  on public.suggestions (status, created_at desc);

-- Reads and status writes are for reIS admins only. get_my_role() resolves the
-- caller's role from spolky_accounts by JWT email where is_active — the same
-- gate already gating feedback_responses.
drop policy if exists "Admin read suggestions" on public.suggestions;
create policy "Admin read suggestions" on public.suggestions
  for select to authenticated
  using (public.get_my_role() = 'reis_admin');

drop policy if exists "Admin update suggestion status" on public.suggestions;
create policy "Admin update suggestion status" on public.suggestions
  for update to authenticated
  using (public.get_my_role() = 'reis_admin')
  with check (public.get_my_role() = 'reis_admin');

-- RLS cannot restrict WHICH COLUMNS an update touches, and Supabase grants
-- broadly on public by default. Revoke first, then grant select plus a
-- column-scoped update: without this an admin session could rewrite a
-- student's own text. Inserts and deletes belong to the service role alone.
revoke all on public.suggestions from anon, authenticated;
grant select on public.suggestions to authenticated;
grant update (status) on public.suggestions to authenticated;

-- Rate limiting -------------------------------------------------------------

create table if not exists public.suggestions_rate_log (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.suggestions_rate_log enable row level security;
-- Deny-all: only the SECURITY DEFINER function below touches it.

create index if not exists suggestions_rate_log_hash_time
  on public.suggestions_rate_log (ip_hash, created_at);

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
   where created_at < now() - interval '24 hours';

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
