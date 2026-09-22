# Verifying the engagement signals

The three feature counters and the per-event map views
(`supabase/migrations/20260922120000_engagement_signals.sql`,
`src/api/featureUsage.ts`) cannot be verified against the deployed project:
proving the write path works there means writing rows to it. They are verified
against a throwaway local stack instead.

Nothing here touches production. No credentials are involved — the JWTs below
are signed with a secret that exists only inside the container.

## 1. A database with just enough of the real schema

```bash
docker run -d --name reis-sqlcheck -e POSTGRES_PASSWORD=pw -p 55433:5432 postgres:15
```

`supabase/migrations/` is **not** replayable from scratch — several files were
written against a schema that already existed (`20260907130000_usage_dimensions.sql`
says so in its first line), so `supabase start` cannot build this database. Create
the three objects this migration depends on and nothing else:

```sql
create role anon nologin;
create role authenticated nologin;
create table public.spolky_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  view_count integer not null default 0,
  click_count integer not null default 0
);
-- Only needed for the browser run in section 4, which seeds a real-looking
-- event so pins render. The SQL checks in section 2 use the four columns above.
alter table public.spolky_events
  add column association_id text,
  add column category      text,
  add column date          date,
  add column end_date      date,
  add column time          text,
  add column venue_kind    text,
  add column room_code     text,
  add column coord_lng     double precision,
  add column coord_lat     double precision,
  add column location      text,
  add column url           text,
  add column subscribers_only boolean default false;
-- Stands in for the real role helper; the deployed one reads the JWT claim.
create function public.get_my_role() returns text language sql stable as $$
  select current_setting('request.test_role', true) $$;
```

Then apply the migration itself, and grant what Supabase's default privileges
would have granted:

```sql
grant usage on schema public to anon, authenticated;
grant select, insert, update on all tables in schema public to anon, authenticated;
```

## 2. What the SQL is checked for

Run each of these and read the result — this is the list that was checked when
the migration was written:

| # | claim |
|---|---|
| A | `increment_event_map_view` rolls up into `event_map_views` under today's date, leaving the Novinky `view_count` / `click_count` alone |
| A2 | a view of an event that no longer exists is dropped silently — no row, no error raised at the student |
| A3 | deleting an event cascades its rollup rows away |
| B | `track_feature_usage` upserts: one row per (install, day, signal), repeats bump `hits` |
| C | an unknown signal label is dropped silently — no row, no exception in a student's face |
| D | `anon` cannot read `feature_usage` back (RLS on, no policies) even with table grants |
| E | `feature_stats` raises `forbidden` for any role that is not `reis_admin` |
| F | `feature_stats` returns `by_feature` + `top_events` for `reis_admin` |
| G | `feature_stats_unchecked` is not executable by `anon` or `authenticated` at all |
| H | the column CHECK rejects a label outside the whitelist, not just the function |
| I | the column CHECK rejects an over-long `install_id` |
| J | the suppression floor lifts at 5 distinct installs (under 5 reports `-1`) |
| J2 | a signal reporting `-1` gets **no** `daily` series — its shape is withheld with its total, rather than published a day at a time |
| J3 | `top_events` is window-scoped: an event whose views all fall outside `p_days` does not appear, however large its all-time total |

## 3. The client write path, over real HTTP

`src/api/__tests__/featureUsage.live.test.ts` drives the **real** module with
the **real** supabase-js client against a local PostgREST. It skips itself
unless all three variables are set.

```bash
docker network create reis-net && docker network connect reis-net reis-sqlcheck
docker run -d --name reis-postgrest --network reis-net -p 55434:3000 \
  -e PGRST_DB_URI="postgres://postgres:pw@reis-sqlcheck:5432/postgres" \
  -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
  -e PGRST_JWT_SECRET="local-only-test-secret-at-least-32-chars-long" \
  postgrest/postgrest
```

supabase-js talks to `<url>/rest/v1/...`, which plain PostgREST does not
serve, so put a path shim in front of it:

```nginx
server {
  listen 80;
  location /rest/v1/ { proxy_pass http://reis-postgrest:3000/; proxy_set_header Host $host; }
  location / { return 404; }
}
```

```bash
docker run -d --name reis-shim --network reis-net -p 55435:80 \
  -v "$PWD/nginx.conf:/etc/nginx/conf.d/default.conf:ro" nginx:alpine
```

Mint two HS256 JWTs against the PostgREST secret — `{"role":"anon"}` for the
client and `{"role":"postgres"}` for the read-back (anon deliberately cannot
read the rows it writes, which is claim D above) — then point the test at the
SHIM, not at PostgREST:

```bash
REIS_LOCAL_PGRST_URL=http://localhost:55435 \
REIS_LOCAL_PGRST_ANON_KEY=<anon jwt> \
REIS_LOCAL_PGRST_ADMIN_KEY=<postgres jwt> \
npx vitest run src/api/__tests__/featureUsage.live.test.ts
```

## 3b. The admin read path

`fetchFeatureStats` hand-writes a zod schema for the RPC's JSON. One renamed
field there fails `safeParse`, returns null, and leaves the admin panel
rendering **nothing at all** — silently, with the numbers sitting in the
database. `src/api/__tests__/featureStats.live.test.ts` runs the two against
each other.

The local `get_my_role()` stub reads the JWT claim PostgREST sets, so mint a
third token with `{"role":"authenticated","reis_role":"reis_admin"}` (and keep a
plain `{"role":"authenticated"}` one to prove the refusal):

```sql
create function public.get_my_role() returns text language sql stable as $$
  select coalesce(current_setting('request.jwt.claims', true)::json->>'reis_role','') $$;
```

```bash
REIS_LOCAL_PGRST_URL=http://localhost:55435 \
REIS_LOCAL_PGRST_REIS_ADMIN_KEY=<reis_admin jwt> \
REIS_LOCAL_PGRST_AUTHED_KEY=<plain authenticated jwt> \
npx vitest run src/api/__tests__/featureStats.live.test.ts
```

Note `dev:web` **cannot** exercise this: `DEV_SOCIETY` is set there, and
`fetchFeatureStats` returns EMPTY before reaching the RPC — the same shape
`fetchUsageStats` has. Seeding `adminFeatureStats` through `window.__reisStore`
shows the panel's layout, but proves nothing about the fetch.

## 4. The triggers, in a real browser

The tests above prove the write path. What they cannot prove is that the hook
is actually mounted on both map surfaces and that a pin click reaches it. For
that, temporarily (and only locally) point `src/services/supabase/config.ts` at
the shim with the anon JWT, and lift the harness guard in
`api/featureUsage.ts`'s `writesAllowed()` — `npm run dev:web` sets `DEV`, so
without that nothing is written, which is the whole point of the guard. Seed an
event into the local `spolky_events` with `venue_kind = 'offcampus'` and
coordinates near campus, dated tomorrow, then:

1. open Mapa, wait more than three seconds → one `map_dwell_3s` row appears;
2. click an event in the Akce list → one `event_map_views` row appears for it
   with `views = 1`, and the Novinky `view_count` / `click_count` stay 0;
3. click the same event again, and its pin → still 1 (the session latch);
4. click a *second* event's pin → only that event's row moves.

The dated rollup is what makes the admin panel's trend charts possible at all:
a counter column could only ever have answered "143 opens, ever".

Reloading the page is a new app session, so `hits` grows while the install
count stays one — which is what `feature_stats` reports.

**Revert both patches afterwards and check `git diff`.** The eduroam signals
cannot be reached this way: the certificate fetch needs a live IS session, and
the native path needs the phone. They are covered by
`src/hooks/data/__tests__/useEduroamSetupSignal.test.tsx`, which asserts which
of the five terminal outcomes counts and which do not.

## 5. Tear down

```bash
docker rm -f reis-shim reis-postgrest reis-sqlcheck && docker network rm reis-net
```

## 6. Applying it for real

No CI applies `supabase/migrations/`. The file has to be run by hand against
the linked project (`npx supabase db query --linked`, never `db push`), and
until it is, the three RPCs 404 and every counter in the app is a silent no-op
— which is the intended failure mode, not an outage.
