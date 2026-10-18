import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSuggestionPayload, resolveScreen, submitSuggestion } from '../suggestions';
import { supabase } from '@/services/spolky/supabaseClient';
import { IndexedDBService } from '@/services/storage';
import { useAppStore } from '@/store/useAppStore';
import { reportEnvironment } from '@/utils/reportEnvironment';
import { setPlatform, __resetPlatformForTests } from '@/platform';

describe('buildSuggestionPayload', () => {
  it('sends the reIS screen and never the host URL', () => {
    const p = buildSuggestionPayload({ type: 'bug', title: 'T', body: 'B' }, 'exams');
    expect(p.screen).toBe('exams');
    expect(JSON.stringify(p)).not.toContain('mendelu.cz');
    expect(JSON.stringify(p)).not.toContain('http');
  });

  it('carries the optional contact through', () => {
    const p = buildSuggestionPayload(
      { type: 'idea', title: 'T', body: 'B', contact: 'a@b.cz' },
      'map'
    );
    expect(p.contact).toBe('a@b.cz');
  });
});

describe('resolveScreen', () => {
  it('accepts a known AppView', () => {
    expect(resolveScreen('studyPlan')).toBe('studyPlan');
  });

  it('falls back to calendar for anything unknown', () => {
    expect(resolveScreen('https://is.mendelu.cz/auth/?studium=123')).toBe('calendar');
    expect(resolveScreen(undefined)).toBe('calendar');
    expect(resolveScreen(42)).toBe('calendar');
  });
});

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

describe('submitSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // No credential is stubbed and none is needed. The old edge function gated on
  // a `x-reis-extension-secret` header whose value shipped inside the bundle —
  // readable by anyone who unzipped the extension, so it was an identifier, not
  // a credential. Authorization is server-side now and unchanged: `suggestions`
  // is deny-all RLS with no insert grant to anon, so the SECURITY DEFINER RPC is
  // the only path to a row.
  it('writes through the RPC with no client credential', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'ok', error: null } as never);

    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });

    expect(r).toEqual({ ok: true });
    const [fn, args] = vi.mocked(supabase.rpc).mock.calls[0]!;
    expect(fn).toBe('submit_suggestion_v3');
    expect(args).toMatchObject({
      p_type: 'bug',
      p_title: 'T',
      p_body: 'B',
      p_diagnostics: null,
      p_screenshot: null,
    });
    // Nothing secret-shaped may travel with the payload.
    expect(JSON.stringify(args)).not.toMatch(/secret/i);
  });

  // The RPC returns false for BOTH a validation failure and the flood guard, so
  // the old 400-vs-429 split is not recoverable here. The client enforces the
  // same limits with maxLength, so an invalid payload from the real UI is
  // unreachable; 'rate_limited' is the honest reading and matches the copy.
  it('maps a rejected result to rate_limited', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'rejected', error: null } as never);
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'rate_limited' });
  });

  it('maps an RPC error to upstream', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { message: 'boom' },
    } as never);
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'upstream' });
  });

  it('maps a thrown network failure to offline', async () => {
    vi.mocked(supabase.rpc).mockRejectedValue(new Error('down') as never);
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: false, error: 'offline' });
  });

  it('sends the attachments the student chose', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'ok', error: null } as never);
    const diagnostics = { entries: [], env: {}, sync: {} } as never;
    await submitSuggestion(
      { type: 'bug', title: 'T', body: 'B' },
      { diagnostics, screenshotBase64: '/9j/AAAA' }
    );
    const [, args] = vi.mocked(supabase.rpc).mock.calls[0]!;
    expect(args).toMatchObject({ p_diagnostics: diagnostics, p_screenshot: '/9j/AAAA' });
  });

  it('says so when the server kept the report but not the screenshot', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 'ok_without_screenshot',
      error: null,
    } as never);
    const r = await submitSuggestion(
      { type: 'bug', title: 'T', body: 'B' },
      { screenshotBase64: '/9j/AAAA' }
    );
    expect(r).toEqual({ ok: true, screenshotDropped: true });
  });

  it('does not report a dropped screenshot when none was sent', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: 'ok_without_screenshot',
      error: null,
    } as never);
    const r = await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    expect(r).toEqual({ ok: true });
  });
});

// Prod, 5.3.0: every phone and iPad report said "map". The screen came from
// `meta.reis_current_view`, which only the desktop tree's view state writes —
// and on the phone the one thing that moves it is a map focus, so after a
// single "show on map" the key said `map` for good. The phone's screen is its
// tab; the desktop's is still the persisted view.
describe('the screen a report records', () => {
  const asPlatform = (kind: 'extension' | 'capacitor') =>
    setPlatform({ kind } as unknown as Parameters<typeof setPlatform>[0]);

  async function sentScreen(): Promise<unknown> {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 'ok', error: null } as never);
    await submitSuggestion({ type: 'bug', title: 'T', body: 'B' });
    return vi.mocked(supabase.rpc).mock.calls[0]![1]!.p_screen;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    __resetPlatformForTests();
    useAppStore.setState({ isTouch: false, isNarrow: false, devPhoneOverride: null });
    // What a phone that once showed a lesson on the map has stored.
    await IndexedDBService.set('meta', 'reis_current_view', 'map');
  });

  afterEach(() => {
    __resetPlatformForTests();
  });

  it('on the phone app, is the tab — not a map focus left in storage', async () => {
    asPlatform('capacitor');
    useAppStore.setState({ mobileTab: 'calendar' });
    expect(await sentScreen()).toBe('calendar');
  });

  // Profil is the only general entry point on the phone, so a report written
  // there says nothing about where the student was. The tab they came from does.
  it('on the phone app, names the tab the student came from when opened from Profil', async () => {
    asPlatform('capacitor');
    useAppStore.setState({ mobileTab: 'profile', lastNonProfileTab: 'exams' });
    expect(await sentScreen()).toBe('exams');
  });

  it('on the phone app, says profile only when the student never left it', async () => {
    asPlatform('capacitor');
    useAppStore.setState({ mobileTab: 'profile', lastNonProfileTab: 'profile' });
    expect(await sentScreen()).toBe('profile');
  });

  // ReportMissingLink and the exam-failure toast open the form in place, so
  // their reports keep naming their own tab.
  it('on the phone app, a report opened in place keeps its own tab', async () => {
    asPlatform('capacitor');
    useAppStore.setState({ mobileTab: 'subjects', lastNonProfileTab: 'exams' });
    expect(await sentScreen()).toBe('subjects');
  });

  it('follows the phone tree in a browser too (touch + narrow)', async () => {
    asPlatform('extension');
    useAppStore.setState({ isTouch: true, isNarrow: true, mobileTab: 'exams' });
    expect(await sentScreen()).toBe('exams');
  });

  it('on the desktop tree, is still the persisted view, whatever the phone tab says', async () => {
    asPlatform('extension');
    await IndexedDBService.set('meta', 'reis_current_view', 'studyPlan');
    useAppStore.setState({ mobileTab: 'profile' });
    expect(await sentScreen()).toBe('studyPlan');
  });
});

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
