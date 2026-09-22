import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * The admin READ path, end to end: the real `fetchFeatureStats` against the real
 * `feature_stats` RPC over real HTTP.
 *
 * This is the half the unit tests cannot cover. `fetchFeatureStats` hand-writes
 * a zod schema for the RPC's JSON, and a single renamed field there fails
 * `safeParse`, returns null, and leaves the admin panel rendering NOTHING at
 * all — silently, with the numbers sitting in the database the whole time.
 * Only running the two against each other catches that.
 *
 * Skipped unless a local stack is pointed at; see docs/verify-engagement-signals.md.
 * The `reis_admin` JWT carries a `reis_role` claim, which is what the local
 * `get_my_role()` stub reads.
 */
const URL_ = process.env.REIS_LOCAL_PGRST_URL;
/** role=authenticated + a reis_role claim: what a real admin session looks like. */
const REIS_ADMIN = process.env.REIS_LOCAL_PGRST_REIS_ADMIN_KEY;
/** role=authenticated, no claim: proves the refusal. */
const PLAIN = process.env.REIS_LOCAL_PGRST_AUTHED_KEY;
/**
 * An RLS-BYPASSING role, for seeding and reading the tables back.
 *
 * Not the reis_admin token: that one is `authenticated`, and these tables have
 * RLS on with no policies, so its writes touch nothing — and PostgREST answers
 * a delete that matched no rows with 204, so the seed failed silently and the
 * totals were whatever earlier runs had left behind.
 */
const DB = process.env.REIS_LOCAL_PGRST_ADMIN_KEY;
const configured = Boolean(URL_ && REIS_ADMIN && PLAIN && DB);

vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: createClient(
    process.env.REIS_LOCAL_PGRST_URL ?? 'http://localhost:1',
    process.env.REIS_LOCAL_PGRST_REIS_ADMIN_KEY ?? 'unset'
  ),
}));
// dev:web sets VITE_DEV_SOCIETY, which makes the real function return EMPTY
// before it ever reaches the RPC — the exact reason the admin panel could not
// be verified from the dev webapp.
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));

import { fetchFeatureStats } from '../featureStats';

const EV_1 = '33333333-3333-3333-3333-333333333333';
const EV_2 = '44444444-4444-4444-4444-444444444444';

/** Reads and writes as a role that bypasses RLS — these tables are closed to anon. */
const admin = () => createClient(URL_!, DB!);

/**
 * Seeded here rather than from the shell, so the expectations below describe
 * rows this file put there. Sharing one database with
 * `featureUsage.live.test.ts` meant its writes landed in these totals and the
 * exact-match assertions failed depending on run order — a fixture that is
 * only correct when you ran the right psql first is not a fixture.
 */
async function seed(): Promise<void> {
  const db = admin();
  const must = <T extends { error: unknown }>(r: T): T => {
    // A silent seed failure is how this file first went green against numbers
    // it never wrote. Never ignore these.
    expect(r.error).toBeNull();
    return r;
  };
  must(
    await db
      .from('event_map_views')
      .delete()
      .neq('event_id', '00000000-0000-0000-0000-000000000000')
  );
  must(await db.from('feature_usage').delete().neq('install_id', ''));
  must(await db.from('spolky_events').delete().neq('id', '00000000-0000-0000-0000-000000000000'));

  must(
    await db.from('spolky_events').insert([
      { id: EV_1, title: 'Mezinárodní večer' },
      { id: EV_2, title: 'Deskovky v klubu' },
    ])
  );
  const today = new Date();
  const iso = (offset: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
      .toISOString()
      .slice(0, 10);
  must(
    await db.from('event_map_views').insert([
      { event_id: EV_1, view_date: iso(0), views: 100 },
      { event_id: EV_1, view_date: iso(1), views: 43 },
      { event_id: EV_2, view_date: iso(0), views: 88 },
    ])
  );
  must(
    await db.from('feature_usage').insert([
      // 7 installs clears the floor; spread over days so there is a shape.
      ...Array.from({ length: 7 }, (_, i) => ({
        install_id: `install-uuid-${i + 1}`,
        usage_date: iso(i % 4),
        feature: 'map_dwell_3s',
        hits: 2,
      })),
      // 6 clears it too.
      ...Array.from({ length: 6 }, (_, i) => ({
        install_id: `install-uuid-${i + 1}`,
        usage_date: iso(0),
        feature: 'eduroam_wifi_configured',
        hits: 1,
      })),
      // 1 does not: reported as -1, with no daily series.
      {
        install_id: 'install-uuid-1',
        usage_date: iso(0),
        feature: 'eduroam_profile_delivered',
        hits: 1,
      },
    ])
  );
}

describe.skipIf(!configured)('fetchFeatureStats against a live PostgREST', () => {
  beforeAll(async () => {
    if (configured) await seed();
  });

  it('parses the RPC payload into exactly what the admin panel reads', async () => {
    const stats = await fetchFeatureStats(30);

    expect(stats).not.toBeNull();
    // Not toMatchObject: a schema drift that DROPPED a field would still pass
    // that. The panel reads these names and no others.
    expect(stats!.byFeature).toEqual([
      { feature: 'eduroam_profile_delivered', installs: -1, hits: -1 },
      { feature: 'eduroam_wifi_configured', installs: 6, hits: 6 },
      { feature: 'map_dwell_3s', installs: 7, hits: 14 },
    ]);
    expect(stats!.topEvents).toEqual([
      { id: '33333333-3333-3333-3333-333333333333', title: 'Mezinárodní večer', mapViews: 143 },
      { id: '44444444-4444-4444-4444-444444444444', title: 'Deskovky v klubu', mapViews: 88 },
    ]);
  });

  // The whole point of the dated rollup: a per-day shape the old counter column
  // could never have produced, for the signals and for each event.
  it('returns a daily shape for a signal and for an event', async () => {
    const stats = await fetchFeatureStats(30);

    const dwell = stats!.daily.filter((d) => d.feature === 'map_dwell_3s');
    expect(dwell.length).toBeGreaterThan(0);
    expect(dwell.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day) && d.installs > 0)).toBe(true);

    const ev = stats!.eventDaily.filter(
      (d) => d.eventId === '33333333-3333-3333-3333-333333333333'
    );
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((d) => d.views > 0)).toBe(true);
  });

  // A signal whose total was withheld must not have its shape published a day
  // at a time — that would hand back exactly what the floor refused.
  it('withholds the daily shape of a suppressed signal', async () => {
    const stats = await fetchFeatureStats(30);

    const suppressed = stats!.byFeature.filter((f) => f.installs === -1).map((f) => f.feature);
    expect(suppressed).toContain('eduroam_profile_delivered');
    for (const feature of suppressed) {
      expect(stats!.daily.filter((d) => d.feature === feature)).toEqual([]);
    }
  });

  // The floor is the privacy claim, so it is asserted on the real payload and
  // not just in SQL: 1 install must never surface as "1".
  it('passes the under-5 floor through as -1 rather than a number', async () => {
    const stats = await fetchFeatureStats(30);
    const suppressed = stats!.byFeature.find((f) => f.feature === 'eduroam_profile_delivered');

    expect(suppressed).toEqual({ feature: 'eduroam_profile_delivered', installs: -1, hits: -1 });
  });

  // A society account must not be able to read these numbers. The tab is gated
  // client-side too, but that gate is not the control — this is.
  it('returns null for a signed-in account without the reis_admin role', async () => {
    const plain = createClient(URL_!, PLAIN!);
    vi.doMock('@/services/admin/authClient', () => ({ adminAuthClient: plain }));
    vi.resetModules();
    const { fetchFeatureStats: refetch } = await import('../featureStats');

    await expect(refetch(30)).resolves.toBeNull();
  });
});
