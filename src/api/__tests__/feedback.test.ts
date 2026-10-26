import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

// Hoisted so the vi.mock factories below (which vitest hoists above these
// imports) can close over it without a temporal-dead-zone error.
const { hasDataConsent, rpc, getUserParams, isHarnessEnabled, getAppVersion } = vi.hoisted(() => ({
  getAppVersion: vi.fn<() => string>(() => '5.4.1'),
  isHarnessEnabled: vi.fn<(...args: unknown[]) => boolean>(() => false),
  hasDataConsent: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
  rpc: vi.fn<(...args: unknown[]) => Promise<{ error: { message: string } | null }>>(async () => ({
    error: null,
  })),
  // Real shape: `facultyId` is always '' (see src/utils/userParams/fetchers.ts);
  // the faculty acronym ('PEF', 'AF', ...) lives in `facultyLabel`, optional
  // exactly like the real UserParams type.
  // `studentId` is what says IS has named a student on this device; it is
  // read as a gate and never sent.
  getUserParams: vi.fn<
    () => Promise<{
      studentId?: string;
      facultyLabel?: string;
      facultyId: string;
      studyProgram?: string;
    } | null>
  >(async () => ({
    studentId: '123456',
    facultyLabel: 'PEF',
    facultyId: '',
  })),
}));

vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('../../services/identity/installId', () => ({
  getInstallId: async () => 'install-1',
}));
vi.mock('../../platform', () => ({
  getPlatform: () => ({ kind: 'extension' }),
}));
vi.mock('../../utils/userParams', () => ({
  getUserParams,
}));
vi.mock('../../utils/appIdentity', () => ({
  getAppVersion: () => getAppVersion(),
}));
// A real student's build, unless a test says otherwise. Mocked rather than
// stubbed through `import.meta.env`, because vitest itself runs with DEV true —
// so without this every test in this file would exercise the harness branch and
// assert nothing about what reIS actually sends.
// Firefox's data-consent toggle. Granted unless a test says otherwise, which is
// also what every non-Firefox browser and the apps answer.
vi.mock('../../utils/firefoxDataConsent', () => ({
  hasDataConsent: (...a: unknown[]) => hasDataConsent(...a),
}));
vi.mock('../../utils/harnessEnabled', () => ({
  isHarnessEnabled: (...a: unknown[]) => isHarnessEnabled(...a),
}));

import { trackDailyUsage, __resetUsageTrackedForTests } from '../feedback';

describe('feedback', () => {
  beforeEach(() => {
    __resetUsageTrackedForTests();
    isHarnessEnabled.mockReturnValue(false);
    hasDataConsent.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ demoMode: false });
  });

  it('does not track usage in demo mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    useAppStore.setState({ demoMode: true });

    await trackDailyUsage();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Faculty and platform are GROUP labels on the same random install id, never
  // student identity — see the file-level comment in feedback.ts.
  it('sends the install id with faculty and platform group labels', async () => {
    await trackDailyUsage();

    expect(rpc).toHaveBeenCalledWith('track_daily_usage', {
      p_student_id: 'install-1',
      p_faculty: 'PEF',
      p_platform: 'extension',
      p_programme: null,
      p_app_version: '5.4.1',
    });
  });

  // The base programme is one more GROUP label (spec 2026-10-09): 'B-OI', never
  // the specialisation suffix, and never sent with anything else.
  it('sends the base programme code beside the faculty', async () => {
    getUserParams.mockResolvedValueOnce({
      studentId: '123456',
      facultyLabel: 'PEF',
      facultyId: '',
      studyProgram: 'B-OI-ZBOI',
    });

    await trackDailyUsage();

    expect(rpc).toHaveBeenCalledWith('track_daily_usage', {
      p_student_id: 'install-1',
      p_faculty: 'PEF',
      p_platform: 'extension',
      p_programme: 'B-OI',
      p_app_version: '5.4.1',
    });
  });

  // The release a device runs is one more GROUP label: every install of a
  // release reports the same string, so it says which build, not who.
  // '0.0.0' is getAppVersion's "unknown" fallback, never a shipped release.
  it('sends null instead of the unknown-version fallback', async () => {
    getAppVersion.mockReturnValueOnce('0.0.0');

    await trackDailyUsage();

    expect(rpc).toHaveBeenCalledWith(
      'track_daily_usage',
      expect.objectContaining({ p_app_version: null })
    );
  });

  // getUserParams()?.facultyId is always '' (see fetchers.ts); the acronym
  // lives in facultyLabel. A student with no label yet (params not hydrated,
  // or the field genuinely missing) must send NULL, never ''.
  it('sends a null faculty when facultyLabel is missing', async () => {
    getUserParams.mockResolvedValueOnce({ studentId: '123456', facultyId: '' });

    await trackDailyUsage();

    expect(rpc).toHaveBeenCalledWith('track_daily_usage', {
      p_student_id: 'install-1',
      p_faculty: null,
      p_platform: 'extension',
      p_programme: null,
      p_app_version: '5.4.1',
    });
  });

  // A `npm run dev:web` server and the deployed preview are not installs. Both
  // used to file a real `track_daily_usage` against production Supabase on
  // every boot, and every fresh browser profile — each headless context in a
  // screenshot sweep — minted a new install id, so each one arrived in the
  // admin console as another "unique install". Measured 2026-09-15: every one
  // of the 164 rows ever labelled `platform = 'web'` came from such a build.
  it('does not track usage from a development or preview build', async () => {
    isHarnessEnabled.mockReturnValue(true);

    await trackDailyUsage();

    expect(rpc).not.toHaveBeenCalled();
  });

  // Latching BEFORE the write succeeded would cost a device its place in the
  // day's count for one bad moment of campus wi-fi — the failure mode is a
  // silent undercount of real students, which is the very thing this whole
  // change exists to stop.
  it('does not latch a failed write, so a later call can still count this device', async () => {
    rpc.mockResolvedValueOnce({ error: { message: 'offline' } });

    await trackDailyUsage();
    await trackDailyUsage();

    expect(rpc).toHaveBeenCalledTimes(2);
  });

  // `initializeStore()` runs from a bare `useEffect(..., [])` under
  // <StrictMode>, which double-invokes effects in development. That turned one
  // boot into two RPCs and left `open_count` at roughly twice the real number.
  // The app's resume handler calls this too, on every return to the app, so a
  // session writes once per day it is used, however often it is reopened.
  it('writes at most once per day in a session', async () => {
    await trackDailyUsage();
    await trackDailyUsage();

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  // The phone app lives in the background for days, and only a cold start
  // used to count, so a student who switched back to reIS every morning was
  // counted on the day iOS last killed it. A new day in the same session
  // counts again. The day is Prague's, as the server stamps usage_date:
  // 22:30 UTC is already tomorrow in Brno in October.
  describe('across midnight in Prague', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('writes again once the Prague day changes, even when the UTC day has not', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-13T21:30:00Z')); // 23:30 in Prague
      await trackDailyUsage();
      vi.setSystemTime(new Date('2026-10-13T21:59:00Z')); // 23:59, same day
      await trackDailyUsage();
      vi.setSystemTime(new Date('2026-10-13T22:30:00Z')); // 00:30 on the 14th
      await trackDailyUsage();

      expect(rpc).toHaveBeenCalledTimes(2);
    });
  });

  // The phone counts a device only after the IS login; the extension ran for
  // anyone on is.mendelu.cz, and 47 devices that never named a student (staff,
  // mostly seen once) sat in the console's totals. No student on the device,
  // no row. The student number is the gate and is never part of the payload.
  it('writes nothing until IS has named a student on this device', async () => {
    getUserParams.mockResolvedValueOnce(null);
    getUserParams.mockResolvedValueOnce({ studentId: '', facultyId: '', facultyLabel: 'PEF' });

    await trackDailyUsage();
    await trackDailyUsage();
    expect(rpc).not.toHaveBeenCalled();

    // Not latched: once IS names the student, the same day still counts.
    await trackDailyUsage();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(rpc.mock.calls[0])).not.toContain('123456');
  });
});

/**
 * This write (and the retired NPS one beside it) was the last place student
 * identity reached Supabase. It now identifies the DEVICE, so it should not be
 * able to see, take, or transmit anything about the student.
 */
describe('feedback — no student identity leaves the device', () => {
  it('takes no student identifier as an argument at all', () => {
    // Arity is the guard: a caller cannot pass a student id even by mistake.
    expect(trackDailyUsage.length).toBe(0);
  });

  it('does not count this install on Firefox while the technical-data toggle is off', async () => {
    // This describe block does not reset the once-per-day memo.
    __resetUsageTrackedForTests();
    hasDataConsent.mockResolvedValue(false);
    await trackDailyUsage();
    expect(hasDataConsent).toHaveBeenCalledWith('technicalAndInteraction');
    expect(rpc).not.toHaveBeenCalled();
  });
});
