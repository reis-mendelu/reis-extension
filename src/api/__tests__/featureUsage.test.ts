import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

const { rpc, isHarnessEnabled } = vi.hoisted(() => ({
  isHarnessEnabled: vi.fn<(...args: unknown[]) => boolean>(() => false),
  rpc: vi.fn<(...args: unknown[]) => Promise<{ error: { message: string } | null }>>(async () => ({
    error: null,
  })),
}));

vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('../../services/identity/installId', () => ({
  getInstallId: async () => 'install-1',
}));
// A real student's build unless a test says otherwise — vitest itself runs with
// DEV true, so without this every assertion below would exercise the harness
// branch and prove nothing about what reIS actually sends.
vi.mock('../../utils/harnessEnabled', () => ({
  isHarnessEnabled: (...a: unknown[]) => isHarnessEnabled(...a),
}));

import {
  trackFeatureSignal,
  trackMapEventView,
  __resetFeatureSignalsForTests,
} from '../featureUsage';

describe('featureUsage', () => {
  beforeEach(() => {
    __resetFeatureSignalsForTests();
    isHarnessEnabled.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ demoMode: false });
  });

  it('sends the install id and the signal label, and nothing else', async () => {
    await trackFeatureSignal('map_dwell_3s');

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('track_feature_usage', {
      p_install_id: 'install-1',
      p_feature: 'map_dwell_3s',
    });
  });

  // The dwell signal answers "how many installs looked at the map today". A
  // student who leaves and comes back five times is still one of them, and
  // `trackDailyUsage` already paid for this lesson: an unlatched write under
  // StrictMode doubled open_count for every device.
  it('sends each signal at most once per app session', async () => {
    await trackFeatureSignal('map_dwell_3s');
    await trackFeatureSignal('map_dwell_3s');
    await trackFeatureSignal('map_dwell_3s');

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('keeps the three signals independent of one another', async () => {
    await trackFeatureSignal('map_dwell_3s');
    await trackFeatureSignal('eduroam_wifi_configured');
    await trackFeatureSignal('eduroam_profile_delivered');

    expect(rpc).toHaveBeenCalledTimes(3);
  });

  // One bad moment of campus wi-fi must not cost this install its place in the
  // day's count for the rest of the session.
  it('retries after a failed write rather than latching on it', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'network' } });

    await trackFeatureSignal('map_dwell_3s');
    await trackFeatureSignal('map_dwell_3s');

    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('writes nothing in demo mode', async () => {
    useAppStore.setState({ demoMode: true });

    await trackFeatureSignal('map_dwell_3s');
    await trackMapEventView('event-1');

    expect(rpc).not.toHaveBeenCalled();
  });

  // check:app loads the built app in a real browser and fails the PR if it
  // writes to Supabase. A dev server and the Vercel preview are not installs.
  it('writes nothing from the dev server or the preview build', async () => {
    isHarnessEnabled.mockReturnValue(true);

    await trackFeatureSignal('map_dwell_3s');
    await trackMapEventView('event-1');

    expect(rpc).not.toHaveBeenCalled();
  });

  it('bumps the map-view counter with an event id and no identity at all', async () => {
    await trackMapEventView('event-1');

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, args] = rpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(fn).toBe('increment_event_map_view');
    expect(args).toEqual({ row_id: 'event-1' });
    expect(JSON.stringify(args)).not.toContain('install');
  });

  // Reopening the same card is the same student looking at the same event.
  it('counts an event once per session however often its card is reopened', async () => {
    await trackMapEventView('event-1');
    await trackMapEventView('event-1');
    await trackMapEventView('event-2');

    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('retries an event view after a failed write', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'network' } });

    await trackMapEventView('event-1');
    await trackMapEventView('event-1');

    expect(rpc).toHaveBeenCalledTimes(2);
  });
});
