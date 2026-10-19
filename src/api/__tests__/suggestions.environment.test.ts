import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitSuggestion } from '../suggestions';
import { supabase } from '@/services/spolky/supabaseClient';
import { useAppStore } from '@/store/useAppStore';
import { reportEnvironment } from '@/utils/reportEnvironment';
import { setPlatform, __resetPlatformForTests } from '@/platform';

vi.mock('@/services/spolky/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}));
vi.mock('@/utils/reportEnvironment', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/reportEnvironment')>();
  return { ...actual, reportEnvironment: vi.fn(actual.reportEnvironment) };
});
vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: { getPlatform: () => 'ios' },
}));

// Row 21 typed their macOS version because nothing else told us; the iPad rows
// all say browser "Unknown". The platform and OS the report was sent from are
// two short labels, sent with every report.
describe('the environment a report records', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPlatformForTests();
    useAppStore.setState({ isTouch: false, isNarrow: false, devPhoneOverride: null });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetPlatformForTests();
  });

  async function sentArgs(): Promise<Record<string, unknown>> {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'ok', error: null } as never);
    await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    return vi.mocked(supabase.rpc).mock.calls[0]![1] as Record<string, unknown>;
  }

  it('sends the platform and the OS', async () => {
    setPlatform({ kind: 'capacitor' } as unknown as Parameters<typeof setPlatform>[0]);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X)'
    );
    const args = await sentArgs();
    expect(args.p_platform).toBe('ios');
    expect(args.p_os_version).toBe('iOS 18');
  });

  it('calls the browser extension an extension', async () => {
    setPlatform({ kind: 'extension' } as unknown as Parameters<typeof setPlatform>[0]);
    expect((await sentArgs()).p_platform).toBe('extension');
  });

  it('still sends the report when the environment cannot be read', async () => {
    vi.mocked(reportEnvironment).mockRejectedValueOnce(new Error('no platform'));
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'ok', error: null } as never);
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: true });
    expect(vi.mocked(supabase.rpc).mock.calls[0]![1]).toMatchObject({ p_platform: '' });
  });
});
