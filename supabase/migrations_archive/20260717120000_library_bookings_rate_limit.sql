-- Durable rate limit for the anonymous library booking proxy (Path B).
-- The bookings-create edge function is secret-gated, but the extension secret
-- ships in the bundle, so it is not truly secret — a per-student server-side
-- cap is the real abuse boundary. We store only a salted hash of the student
-- ID (never the raw ID) and a timestamp; nothing else.

create table if not exists public.library_bookings_log (
  id bigint generated always as identity primary key,
  student_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.library_bookings_log enable row level security;
-- Deny-all for direct row access: only the SECURITY DEFINER RPC below touches it.

create index if not exists library_bookings_log_hash_time
  on public.library_bookings_log (student_hash, created_at);

-- Atomic check-and-log: returns true and records an attempt when the student is
-- under the hourly cap, false (no insert) when at/over it. Counting attempts
-- (not just successes) prevents hammering the upstream.
create or replace function public.check_and_log_booking(
  p_student_hash text,
  p_max int default 5
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent int;
begin
  -- Serialize concurrent requests for the same student so the check-then-insert
  -- can't race (TOCTOU): two parallel bookings could otherwise both read the old
  -- count and both insert, bypassing the cap. The lock is released at commit.
  perform pg_advisory_xact_lock(hashtext(p_student_hash));

  select count(*) into recent
    from public.library_bookings_log
   where student_hash = p_student_hash
     and created_at > now() - interval '1 hour';

  if recent >= p_max then
    return false;
  end if;

  insert into public.library_bookings_log (student_hash) values (p_student_hash);
  return true;
end;
$$;

revoke all on function public.check_and_log_booking(text, int) from public;
grant execute on function public.check_and_log_booking(text, int) to service_role;
