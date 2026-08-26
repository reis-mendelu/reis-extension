/**
 * The ISKAM iframe's boot file. The only logic it owns is `reportingAllowed`, and
 * that predicate is the store listing's privacy promise in code.
 *
 * It has to gate on BOTH flags. The reporters are installed at module load so
 * they catch startup failures, but the persisted opt-out arrives later from
 * IndexedDB -- so before hydration `errorReportingEnabled` is only an optimistic
 * default. Reporting during that window would send telemetry for a student who
 * had already turned it off, which is exactly what the listing says cannot happen.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const installErrorReporter = vi.hoisted(() => vi.fn());
const initTelemetry = vi.hoisted(() => vi.fn());
const render = vi.hoisted(() => vi.fn());
const createRoot = vi.hoisted(() => vi.fn(() => ({ render })));
const getState = vi.hoisted(() => vi.fn());

vi.mock('react-dom/client', () => ({ createRoot }));
vi.mock('@/services/errorReporter/reporter', () => ({ installErrorReporter }));
vi.mock('@/services/errorReporter/telemetry', () => ({ initTelemetry }));
vi.mock('@/store/useAppStore', () => ({ useAppStore: { getState } }));
vi.mock('../iskam/IskamApp', () => ({ IskamApp: () => null }));

/** Boot the entrypoint against a fresh root element. */
async function boot() {
  document.body.innerHTML = '<div id="root"></div>';
  await import('../iskam/main');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  getState.mockReturnValue({ errorReportingHydrated: true, errorReportingEnabled: true });
});

describe('boot', () => {
  it('mounts the app into #root', async () => {
    await boot();

    expect(createRoot).toHaveBeenCalledTimes(1);
    // Cast: the mock's inferred signature takes no args, so the tuple has no
    // index 0 as far as TS is concerned.
    const [container] = createRoot.mock.calls[0] as unknown as [Element];
    expect(container).toBe(document.getElementById('root'));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('installs both reporters before rendering', async () => {
    // Installed at module load precisely so a crash during the first render is
    // still captured.
    await boot();

    expect(installErrorReporter).toHaveBeenCalledTimes(1);
    expect(initTelemetry).toHaveBeenCalledTimes(1);
  });
});

describe('reportingAllowed gate', () => {
  /** The predicate both reporters were handed. */
  async function gate() {
    await boot();
    return installErrorReporter.mock.calls[0]![0] as () => boolean;
  }

  it('allows reporting once hydrated and enabled', async () => {
    const allowed = await gate();
    expect(allowed()).toBe(true);
  });

  it('BLOCKS reporting before the opt-out has hydrated', async () => {
    // The window this closes: enabled is still the optimistic default and the
    // student's stored "off" has not been read back yet.
    getState.mockReturnValue({ errorReportingHydrated: false, errorReportingEnabled: true });
    const allowed = await gate();
    expect(allowed()).toBe(false);
  });

  it('blocks reporting when the student has opted out', async () => {
    getState.mockReturnValue({ errorReportingHydrated: true, errorReportingEnabled: false });
    const allowed = await gate();
    expect(allowed()).toBe(false);
  });

  it('blocks when neither flag is set', async () => {
    getState.mockReturnValue({ errorReportingHydrated: false, errorReportingEnabled: false });
    const allowed = await gate();
    expect(allowed()).toBe(false);
  });

  it('is re-evaluated per call, not captured at install time', async () => {
    // Hydration lands after install, so a predicate that snapshotted the flags
    // would stay stuck on the pre-hydration answer for the whole session.
    getState.mockReturnValue({ errorReportingHydrated: false, errorReportingEnabled: true });
    const allowed = await gate();
    expect(allowed()).toBe(false);

    getState.mockReturnValue({ errorReportingHydrated: true, errorReportingEnabled: true });
    expect(allowed()).toBe(true);
  });

  it('hands the same predicate to telemetry as to the error reporter', async () => {
    await boot();
    expect(initTelemetry.mock.calls[0]![0]).toBe(installErrorReporter.mock.calls[0]![0]);
  });
});
