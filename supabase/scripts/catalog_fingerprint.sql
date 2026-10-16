-- What `supabase db diff` does not compare: who may call or read what, and the
-- state that lives in rows (buckets, the cron job). Reads the catalogs only, no
-- table data. Run it against prod and against a local build and diff the two:
--
--   npx supabase db query --linked -f supabase/scripts/catalog_fingerprint.sql
--   npx supabase db query --local  -f supabase/scripts/catalog_fingerprint.sql
--
-- Empty diff = the local build grants, stores and schedules what prod does.
with acl as (
  select 'function' as kind, p.oid::regprocedure::text as obj,
         coalesce(p.proacl, acldefault('f', p.proowner)) as acl
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace
  union all
  select case c.relkind when 'S' then 'sequence' when 'v' then 'view' else 'table' end,
         c.oid::regclass::text,
         coalesce(c.relacl, acldefault((case c.relkind when 'S' then 's' else 'r' end)::"char", c.relowner))
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'S')
  union all
  select 'schema', n.nspname, coalesce(n.nspacl, acldefault('n', n.nspowner))
  from pg_namespace n
  where n.nspname = 'public'
),
lines as (
  -- grants, without the grantor (postgres locally, supabase_admin in places on prod)
  select format('grant  %s %s -> %s: %s', a.kind, a.obj,
                case e.grantee when 0 then 'PUBLIC' else e.grantee::regrole::text end,
                string_agg(e.privilege_type, ',' order by e.privilege_type)) as line
  from acl a, aclexplode(a.acl) e
  where e.grantee = 0
     or e.grantee::regrole::text in ('anon', 'authenticated', 'service_role', 'postgres')
  group by a.kind, a.obj, e.grantee
  union all
  -- column grants, e.g. UPDATE(status)
  select format('grant  column %s.%s -> %s: %s', c.oid::regclass, att.attname,
                e.grantee::regrole, string_agg(e.privilege_type, ',' order by e.privilege_type))
  from pg_attribute att
  join pg_class c on c.oid = att.attrelid
  cross join lateral aclexplode(att.attacl) e
  where c.relnamespace = 'public'::regnamespace and att.attacl is not null
  group by c.oid, att.attname, e.grantee
  union all
  select format('owner  %s %s', 'function', p.oid::regprocedure) || ' ' || p.proowner::regrole::text
  from pg_proc p where p.pronamespace = 'public'::regnamespace
  union all
  select format('owner  table %s %s', c.oid::regclass, c.relowner::regrole)
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p', 'v', 'm', 'S')
  union all
  select format('rls    %s enabled=%s forced=%s', c.oid::regclass, c.relrowsecurity, c.relforcerowsecurity)
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
  union all
  select format('policy %s.%s %s %s %s to %s using %s check %s', schemaname, tablename,
                quote_ident(policyname), permissive, cmd, roles::text,
                coalesce(qual, '-'), coalesce(with_check, '-'))
  from pg_policies
  where schemaname in ('public', 'storage')
  union all
  select format('fn     %s secdef=%s volatile=%s config=%s body=%s', p.oid::regprocedure,
                p.prosecdef, p.provolatile, coalesce(p.proconfig::text, '-'), md5(p.prosrc))
  from pg_proc p where p.pronamespace = 'public'::regnamespace
  union all
  select format('trig   %s %s %s', t.tgrelid::regclass, t.tgname, md5(pg_get_triggerdef(t.oid)))
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  where not t.tgisinternal and c.relnamespace = 'public'::regnamespace
  union all
  select format('bucket %s public=%s limit=%s mime=%s', id, public,
                coalesce(file_size_limit::text, '-'), coalesce(allowed_mime_types::text, '-'))
  from storage.buckets
  union all
  select format('cron   %s %s %s active=%s', jobname, schedule, command, active)
  from cron.job
  union all
  select format('ext    %s in %s', extname, extnamespace::regnamespace)
  from pg_extension
  where extname in ('pg_cron', 'pg_stat_statements', 'pgcrypto', 'supabase_vault', 'uuid-ossp')
)
select line from lines order by line;
