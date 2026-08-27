/**
 * The extension iframe's boot file, and the twin of iskam/main.tsx.
 *
 * It showed 30/30 statements — 100%, inside the strictest floor in the config —
 * with no test of its own: the coverage came entirely from a capacitor boot test
 * importing it for its side effects. Line coverage is not assertion coverage, and
 * the proof was that `reportingAllowed()` could be replaced with `return true`
 * and all 2,517 tests still passed. That predicate IS the store listing's privacy
 * promise, so it was the single most consequential untested line in the app.
 *
 * Both flags matter. The reporters are installed at module load so they catch
 * startup failures, but the persisted opt-out arrives later from IndexedDB — so
 * before hydration `errorReportingEnabled` is only an optimistic default.
 * Reporting in that window sends telemetry for a student who had already turned
 * it off.
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
vi.mock('@/App.tsx', () => ({ default: () => null }));
vi.mock('@/components/AppShell', () => ({ AppShell: () => null }));
vi.mock('@/utils/devFeatures', () => ({}));

async function boot() {
  document.body.innerHTML = '<div id="root"></div>';
  await import('../main/main');
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
    const [container] = createRoot.mock.calls[0] as unknown as [Element];
    expect(container).toBe(document.getElementById('root'));
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('installs both reporters', async () => {
    await boot();

    expect(installErrorReporter).toHaveBeenCalledTimes(1);
    expect(initTelemetry).toHaveBeenCalledTimes(1);
  });
});

describe('reportingAllowed gate', () => {
  async function gate() {
    await boot();
    return installErrorReporter.mock.calls[0]![0] as () => boolean;
  }

  it('allows reporting once hydrated and enabled', async () => {
    expect((await gate())()).toBe(true);
  });

  it('BLOCKS reporting before the opt-out has hydrated', async () => {
    getState.mockReturnValue({ errorReportingHydrated: false, errorReportingEnabled: true });
    expect((await gate())()).toBe(false);
  });

  it('blocks reporting when the student has opted out', async () => {
    getState.mockReturnValue({ errorReportingHydrated: true, errorReportingEnabled: false });
    expect((await gate())()).toBe(false);
  });

  it('blocks when neither flag is set', async () => {
    getState.mockReturnValue({ errorReportingHydrated: false, errorReportingEnabled: false });
    expect((await gate())()).toBe(false);
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
