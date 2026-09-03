-- reIS transmits nothing about a failure. Remove the server side of that.
--
-- The client stopped sending in the same change that added this migration:
-- `services/errorReporter/` is deleted, `logError` is now console-only, and
-- `src/test/guards/noStudentDataLeaves.test.ts` fails if the vocabulary comes
-- back. Dropping the objects here is what makes the promise true rather than
-- merely intended — a policy that says "we do not collect this" while the table
-- still exists is a table waiting to be filled again.
--
-- What is lost, stated plainly: 612 reports over four months, 64 distinct
-- contexts, including the parser failures that were the only early warning that
-- IS Mendelu changed its HTML. That trade was made deliberately.
--
-- Applied IMMEDIATELY, not after the rollout window, and that is the point.
-- Every released client keeps transmitting until it updates, so waiting means
-- error reports keep arriving for weeks after the project has said they do not.
-- Dropping the RPC is what stops those senders — it is the only control that
-- reaches a build already on someone's phone.
--
-- The cost is log noise: old clients get a rejected RPC. Each call is inside a
-- try/catch that routes to `logError`, which is now console-only, so nothing
-- user-visible breaks. Expect failed `report_error_v2` calls in the Supabase
-- logs for as long as old builds are in the wild; that is the sound of the
-- promise being kept, not a fault.

-- Entry points first, so nothing can insert while the tables are going away.
drop function if exists public.report_error_v2(
  text, text, text, text, int, text, timestamptz, text, text, text
);
drop function if exists public.report_error(text, text, text, int, text, text, text);

-- Any overload the signatures above did not name.
do $$
declare r record;
begin
  for r in
    select oid::regprocedure as sig
      from pg_proc
     where pronamespace = 'public'::regnamespace
       and proname in ('report_error', 'report_error_v2')
  loop
    execute format('drop function if exists %s', r.sig);
  end loop;
end $$;

-- `error_groups` aggregates `error_reports` by fingerprint; drop the aggregate
-- first so no foreign key or trigger outlives its source.
drop table if exists public.error_groups;
drop table if exists public.error_reports;
