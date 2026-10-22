-- Questions reIS asks students in Novinky, written in the admin console and
-- live without a store release (docs/superpowers/specs/2026-10-22-novinky-questions-design.md).
--
--   reis_questions         a prompt plus 1–5 buttons, live between starts_at and ends_at
--   reis_question_counts   (question, day, key) -> n; key is 'seen' or a button key
--   count_question         the one anon write: a question id and a key, NO identifier
--   question_results       reis_admin only: every question with its counts
--
-- No install id, on purpose. The device remembers what it already counted
-- (countedOpens.ts), as it does for Novinky clicks and map opens. Questions are
-- written ad hoc and can be about anything; kept on one id, the answers would
-- add up to an opinion history per install.
--
-- Additive and safe for every released build (checked v5.1.1 … v5.4.1): two new
-- tables and two new functions that no released build references. Nothing
-- existing is changed. Safe to re-run.
-- supabase/tests/reis_questions.test.sql checks the behaviour.

-- A button list the client can render: 1–5 buttons, each with a distinct key
-- (never 'seen', which is the denominator), both labels, and an optional https
-- link. Checked here so a hand-made row cannot crash a student's Novinky.
create or replace function public.reis_question_buttons_ok(b jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(b) = 'array'
     and jsonb_array_length(b) between 1 and 5
     and (select count(distinct e->>'key') from jsonb_array_elements(b) e) = jsonb_array_length(b)
     and not exists (
       select 1 from jsonb_array_elements(b) e
        where jsonb_typeof(e) <> 'object'
           -- Strings, not just values that read as text: the clients parse
           -- every field as a string and drop a question that is not.
           or coalesce(jsonb_typeof(e->'key'), '') <> 'string'
           or coalesce(jsonb_typeof(e->'cz'), '') <> 'string'
           or coalesce(jsonb_typeof(e->'en'), '') <> 'string'
           or (e ? 'url' and jsonb_typeof(e->'url') <> 'string')
           or (e ? 'hintCz' and jsonb_typeof(e->'hintCz') <> 'string')
           or (e ? 'hintEn' and jsonb_typeof(e->'hintEn') <> 'string')
           or coalesce(e->>'key', '') !~ '^[a-z0-9_]{1,20}$'
           or e->>'key' = 'seen'
           or length(trim(coalesce(e->>'cz', ''))) not between 1 and 40
           or length(trim(coalesce(e->>'en', ''))) not between 1 and 40
           or (e ? 'url' and (coalesce(e->>'url', '') !~ '^https://[^\s]{4,}$'
                              or length(e->>'url') > 500))
           -- The words under a scale's ends ("nejhorší" under 1), optional.
           or (e ? 'hintCz' and length(trim(coalesce(e->>'hintCz', ''))) not between 1 and 20)
           or (e ? 'hintEn' and length(trim(coalesce(e->>'hintEn', ''))) not between 1 and 20)
     );
$$;

create table if not exists public.reis_questions (
  id uuid primary key default gen_random_uuid(),
  prompt_cz text not null check (length(trim(prompt_cz)) between 1 and 200),
  prompt_en text not null check (length(trim(prompt_en)) between 1 and 200),
  note_cz text check (note_cz is null or length(note_cz) <= 300),
  note_en text check (note_en is null or length(note_en) <= 300),
  buttons jsonb not null check (public.reis_question_buttons_ok(buttons)),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  -- Faculty keys as useViewer knows them ('pef', 'af', …); null = everyone. The
  -- device decides, so targeting sends nothing.
  faculties text[] check (faculties is null or cardinality(faculties) between 1 and 10),
  created_at timestamptz not null default now(),
  -- `>=`, not `>`: the console ends a question by setting ends_at = now(), and
  -- one that has not started yet ends as a zero-length window, never shown.
  constraint reis_questions_dates_chk check (ends_at >= starts_at)
);

comment on table public.reis_questions is
  'Ano/Ne, 1–5 or link questions shown in Novinky by builds from 5.5.0 on. Counts: reis_question_counts.';

create table if not exists public.reis_question_counts (
  question_id uuid not null references public.reis_questions(id) on delete cascade,
  count_date date not null default current_date,
  key text not null,
  n integer not null default 0,
  primary key (question_id, count_date, key)
);

alter table public.reis_questions enable row level security;
alter table public.reis_question_counts enable row level security;

-- Students read only what is live; the console (reis_admin) reads everything.
drop policy if exists reis_questions_read_live on public.reis_questions;
create policy reis_questions_read_live on public.reis_questions
  for select to anon, authenticated
  using (starts_at <= now() and ends_at > now());

drop policy if exists reis_questions_admin_read on public.reis_questions;
create policy reis_questions_admin_read on public.reis_questions
  for select to authenticated using (public.get_my_role() = 'reis_admin');

drop policy if exists reis_questions_admin_insert on public.reis_questions;
create policy reis_questions_admin_insert on public.reis_questions
  for insert to authenticated with check (public.get_my_role() = 'reis_admin');

drop policy if exists reis_questions_admin_update on public.reis_questions;
create policy reis_questions_admin_update on public.reis_questions
  for update to authenticated
  using (public.get_my_role() = 'reis_admin')
  with check (public.get_my_role() = 'reis_admin');

-- The schema's default privileges grant every new table to anon; take back
-- what students never need. Deleting a question would also delete its counts,
-- so the console only ends one (ends_at = now()).
revoke insert, update, delete, truncate on public.reis_questions from anon;
revoke delete, truncate on public.reis_questions from authenticated;
-- Counts are written only through count_question and read only through
-- question_results; no role reads or writes the table directly.
revoke all on public.reis_question_counts from anon, authenticated;

create or replace function public.count_question(p_question_id uuid, p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  -- Only a live question and a key it has (or 'seen'). Anything else is
  -- dropped, not raised: a counter must never error in a student's face, and
  -- an ended question tapped from a stale Novinky is a race, not a fault.
  if not exists (
    select 1 from public.reis_questions q
     where q.id = p_question_id
       and q.starts_at <= now() and q.ends_at > now()
       and (p_key = 'seen'
            or exists (select 1 from jsonb_array_elements(q.buttons) b where b->>'key' = p_key))
  ) then
    return;
  end if;
  insert into public.reis_question_counts (question_id, count_date, key, n)
  values (p_question_id, current_date, p_key, 1)
  on conflict (question_id, count_date, key)
    do update set n = public.reis_question_counts.n + 1;
end;
$$;

revoke all on function public.count_question(uuid, text) from public;
grant execute on function public.count_question(uuid, text) to anon, authenticated;

create or replace function public.question_results()
returns json language plpgsql stable security definer set search_path = '' as $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', q.id,
      'prompt_cz', q.prompt_cz,
      'prompt_en', q.prompt_en,
      'note_cz', q.note_cz,
      'note_en', q.note_en,
      'buttons', q.buttons,
      'starts_at', q.starts_at,
      'ends_at', q.ends_at,
      'faculties', q.faculties,
      'totals', coalesce((
        select json_object_agg(t.key, t.n)
          from (select c.key, sum(c.n)::int as n from public.reis_question_counts c
                 where c.question_id = q.id group by c.key) t
      ), '{}'::json),
      'daily', coalesce((
        select json_agg(json_build_object('day', c.count_date, 'key', c.key, 'n', c.n)
                        order by c.count_date, c.key)
          from public.reis_question_counts c where c.question_id = q.id
      ), '[]'::json)
    ) order by q.starts_at desc)
    from public.reis_questions q
  ), '[]'::json);
end;
$$;

-- Not granted to anon: revoking from PUBLIC alone leaves the role-level grant
-- the default privileges gave (memory: supabase-revoke-from-public-is-not-enough).
revoke all on function public.question_results() from public;
revoke execute on function public.question_results() from anon;
grant execute on function public.question_results() to authenticated;
-- reis_question_buttons_ok keeps its default grants: the CHECK runs as the
-- writing role, so revoking it would refuse the console's own inserts.
