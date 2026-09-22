import { describe, it, expect, vi, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * End-to-end proof that the counters in `api/featureUsage.ts` actually land in
 * a database — the real supabase-js client, over real HTTP, into the real SQL
 * from `supabase/migrations/20260922120000_engagement_signals.sql`. Everything
 * the unit tests next door assert is a mock; this file asserts the effect.
 *
 * SKIPPED unless a local stack is pointed at, so CI (which has none) stays
 * green. To run it, bring up Postgres + PostgREST, apply the migration, and
 * export the three variables below — the exact sequence is in
 * `docs/verify-engagement-signals.md`.
 *
 * Never point this at the deployed project: it writes rows.
 */
const URL_ = process.env.REIS_LOCAL_PGRST_URL;
const ANON = process.env.REIS_LOCAL_PGRST_ANON_KEY;
const ADMIN = process.env.REIS_LOCAL_PGRST_ADMIN_KEY;
const configured = Boolean(URL_ && ANON && ADMIN);

// The module under test reads its client from here. Pointing it at the local
// stack is the ONLY substitution this file makes to the shipped write path —
// the RPC names, the payloads and the SQL are all the real ones.
vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: createClient(
    process.env.REIS_LOCAL_PGRST_URL ?? 'http://localhost:1',
    process.env.REIS_LOCAL_PGRST_ANON_KEY ?? 'unset'
  ),
}));
vi.mock('../../utils/harnessEnabled', () => ({ isHarnessEnabled: () => false }));

// Hoisted so the mock factory below (which vitest lifts above these imports)
// can close over it: the SAME install id across calls is exactly what the
// per-install upsert has to be tested with.
const { INSTALL } = vi.hoisted(() => ({ INSTALL: `live-${Date.now()}` }));
vi.mock('../../services/identity/installId', () => ({
  getInstallId: async () => INSTALL,
}));

import {
  trackFeatureSignal,
  trackMapEventView,
  __resetFeatureSignalsForTests,
} from '../featureUsage';

// Reads go through a role that bypasses RLS, because anon deliberately cannot
// read `feature_usage` back — which is itself part of what this file proves.
const admin = () => createClient(URL_!, ADMIN!);

describe.skipIf(!configured)('featureUsage against a live PostgREST', () => {
  let eventId = '';

  beforeAll(async () => {
    const { data, error } = await admin()
      .from('spolky_events')
      .insert({ title: `live test ${INSTALL}` })
      .select('id')
      .single();
    expect(error).toBeNull();
    eventId = (data as { id: string }).id;
  });

  it('writes a real feature_usage row, and anon cannot read it back', async () => {
    __resetFeatureSignalsForTests();
    await trackFeatureSignal('map_dwell_3s');

    const { data } = await admin()
      .from('feature_usage')
      .select('install_id, feature, hits')
      .eq('install_id', INSTALL)
      .eq('feature', 'map_dwell_3s');
    expect(data).toEqual([{ install_id: INSTALL, feature: 'map_dwell_3s', hits: 1 }]);

    // The same select as anon: RLS is on with no policies, so it sees nothing.
    const asAnon = createClient(URL_!, ANON!);
    const { data: leaked } = await asAnon.from('feature_usage').select('install_id');
    expect(leaked ?? []).toEqual([]);
  });

  it("rolls the view up under today's date and leaves the feed counters alone", async () => {
    __resetFeatureSignalsForTests();
    await trackMapEventView(eventId);
    await trackMapEventView(eventId); // same session: must not count twice

    const { data } = await admin()
      .from('event_map_views')
      .select('event_id, views')
      .eq('event_id', eventId);
    expect(data).toEqual([{ event_id: eventId, views: 1 }]);

    // The Novinky feed metrics are a different number and must not move.
    const { data: ev } = await admin()
      .from('spolky_events')
      .select('view_count, click_count')
      .eq('id', eventId)
      .single();
    expect(ev).toEqual({ view_count: 0, click_count: 0 });
  });

  // A view of an event that has since been deleted is a race, not a fault: the
  // RPC checks first, so nothing is raised at the student and nothing is stored.
  it('drops a view of an event that no longer exists without erroring', async () => {
    __resetFeatureSignalsForTests();
    await expect(
      trackMapEventView('00000000-0000-0000-0000-000000000000')
    ).resolves.toBeUndefined();

    const { data } = await admin()
      .from('event_map_views')
      .select('event_id')
      .eq('event_id', '00000000-0000-0000-0000-000000000000');
    expect(data).toEqual([]);
  });

  // A second app session on the same day is the same install: one row, two
  // hits. That is what makes `count(distinct install_id)` in `feature_stats`
  // answer "how many installs", rather than "how many times".
  it('counts a second session on the same day as another hit, not another row', async () => {
    const rows = () =>
      admin()
        .from('feature_usage')
        .select('install_id, feature, hits')
        .eq('install_id', INSTALL)
        .eq('feature', 'eduroam_wifi_configured');

    __resetFeatureSignalsForTests();
    await trackFeatureSignal('eduroam_wifi_configured');
    expect((await rows()).data).toEqual([
      { install_id: INSTALL, feature: 'eduroam_wifi_configured', hits: 1 },
    ]);

    __resetFeatureSignalsForTests();
    await trackFeatureSignal('eduroam_wifi_configured');
    expect((await rows()).data).toEqual([
      { install_id: INSTALL, feature: 'eduroam_wifi_configured', hits: 2 },
    ]);
  });
});
