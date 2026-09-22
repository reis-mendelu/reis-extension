import { describe, it, expect, vi } from 'vitest';
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
const ADMIN = process.env.REIS_LOCAL_PGRST_REIS_ADMIN_KEY;
const PLAIN = process.env.REIS_LOCAL_PGRST_AUTHED_KEY;
const configured = Boolean(URL_ && ADMIN && PLAIN);

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

describe.skipIf(!configured)('fetchFeatureStats against a live PostgREST', () => {
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
