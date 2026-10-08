import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock factories are hoisted above every const, so the mocks live in vi.hoisted.
const { native, runSyncMock, APP, LIST } = vi.hoisted(() => {
  const APP = 'https://www.googleapis.com/auth/calendar.app.created';
  const LIST = 'https://www.googleapis.com/auth/calendar.calendarlist.readonly';
  return {
    APP,
    LIST,
    runSyncMock: vi.fn(),
    native: {
      isAvailable: vi.fn(async () => ({ available: true })),
      connect: vi.fn(async (): Promise<{ email: string | null; scopes: string[] }> => ({
        email: 'reis.mendelu@gmail.com',
        scopes: [APP, LIST],
      })),
      accessToken: vi.fn(async () => ({ token: 'T' })),
      invalidateToken: vi.fn(async () => {}),
      disconnect: vi.fn(async () => {}),
      status: vi.fn(async () => ({ connected: true, email: 'reis.mendelu@gmail.com' })),
    },
  };
});
vi.mock('../googleCalendarNative', () => ({
  GoogleCalendarNative: native,
  SCOPE_APP_CREATED: APP,
  SCOPE_CALENDAR_LIST: LIST,
}));
vi.mock('../runSync', () => ({ runSync: (...a: unknown[]) => runSyncMock(...a) }));

import {
  syncGoogleCalendarNow,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
} from '../controller';
import { loadSyncState, saveSyncState } from '../syncStateStore';
import { AuthRevokedError } from '../calendarHttp';
import type { CalendarApi } from '../calendarApi';
import { useAppStore } from '../../../store/useAppStore';
import { installTestPlatform } from './testPlatform';

beforeEach(async () => {
  installTestPlatform();
  vi.clearAllMocks();
  useAppStore.setState({
    schedule: { data: [{ id: '1' } as never], status: 'success' },
    exams: { data: [], status: 'success', error: null },
    customEvents: [],
    language: 'cz',
  } as never);
});

describe('controller', () => {
  it('connect enables and runs a sync', async () => {
    runSyncMock.mockResolvedValue({
      kind: 'ok',
      written: 1,
      state: {
        calendarId: 'c',
        held: {},
        lastSyncAt: 1,
        pastFillPending: false,
        reisDeleted: {},
        skipped: {},
      },
    });
    await connectGoogleCalendar();
    expect((await loadSyncState()).enabled).toBe(true);
    expect(runSyncMock).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().gcal.connected).toBe(true);
  });
  it('connect without calendar.app.created does not enable', async () => {
    native.connect.mockResolvedValueOnce({ email: 'x@y', scopes: [LIST] });
    await connectGoogleCalendar();
    expect((await loadSyncState()).enabled).toBe(false);
    expect(runSyncMock).not.toHaveBeenCalled();
    expect(useAppStore.getState().gcal.notice).toBe('scopeMissing');
  });
  it('connect without the calendar list asks once more, then proceeds', async () => {
    native.connect
      .mockResolvedValueOnce({ email: 'x@y', scopes: [APP] })
      .mockResolvedValueOnce({ email: 'x@y', scopes: [APP] });
    runSyncMock.mockResolvedValue({
      kind: 'ok',
      written: 1,
      state: {
        calendarId: 'c',
        held: {},
        lastSyncAt: 1,
        pastFillPending: false,
        reisDeleted: {},
        skipped: {},
      },
    });
    await connectGoogleCalendar();
    expect(native.connect).toHaveBeenCalledTimes(2);
    expect((await loadSyncState()).enabled).toBe(true);
  });
  it('change with an unchanged fingerprint and a fresh sync does nothing', async () => {
    runSyncMock.mockResolvedValue({
      kind: 'ok',
      written: 0,
      state: {
        calendarId: 'c',
        held: {},
        lastSyncAt: Date.now(),
        pastFillPending: false,
        reisDeleted: {},
        skipped: {},
      },
    });
    await connectGoogleCalendar();
    runSyncMock.mockClear();
    await syncGoogleCalendarNow('change');
    expect(runSyncMock).not.toHaveBeenCalled();
  });
  it('a held-back delete re-runs on the next change even with unchanged sources', async () => {
    runSyncMock.mockResolvedValue({
      kind: 'ok',
      written: 0,
      state: {
        calendarId: 'c',
        held: { lesson: 'l2,l3' },
        lastSyncAt: 1,
        pastFillPending: false,
        reisDeleted: {},
        skipped: {},
      },
    });
    await connectGoogleCalendar();
    runSyncMock.mockClear();
    await syncGoogleCalendarNow('change');
    expect(runSyncMock).toHaveBeenCalledTimes(1);
  });
  it('calendarGone turns the sync off and does not recreate', async () => {
    await saveSyncState({
      enabled: true,
      calendarId: 'c',
      held: {},
      lastSyncAt: 1,
      pastFillPending: false,
      reisDeleted: {},
      skipped: {},
      sourcesFingerprint: null,
    });
    runSyncMock.mockResolvedValue({ kind: 'calendarGone' });
    await syncGoogleCalendarNow('change');
    expect((await loadSyncState()).enabled).toBe(false);
    expect(useAppStore.getState().gcal.notice).toBe('calendarGone');
  });
  it('unchanged sources still re-run after 6 h, to notice a deleted Rozvrh or revoked access', async () => {
    runSyncMock.mockResolvedValue({
      kind: 'ok',
      written: 0,
      state: {
        calendarId: 'c',
        held: {},
        lastSyncAt: Date.now() - 7 * 3600_000,
        pastFillPending: false,
        reisDeleted: {},
        skipped: {},
      },
    });
    await connectGoogleCalendar();
    runSyncMock.mockClear();
    await syncGoogleCalendarNow('change');
    expect(runSyncMock).toHaveBeenCalledTimes(1);
  });
  it('a trigger during a running sync is not lost: it re-runs once afterwards', async () => {
    await saveSyncState({
      enabled: true,
      calendarId: 'c',
      held: {},
      lastSyncAt: 1,
      pastFillPending: false,
      reisDeleted: {},
      skipped: {},
      sourcesFingerprint: null,
    });
    let release!: () => void;
    const ok = {
      kind: 'ok',
      written: 0,
      state: {
        calendarId: 'c',
        held: {},
        lastSyncAt: 1,
        pastFillPending: false,
        reisDeleted: {},
        skipped: {},
      },
    };
    runSyncMock
      .mockImplementationOnce(() => new Promise((r) => (release = () => r(ok))))
      .mockResolvedValue(ok);
    const first = syncGoogleCalendarNow('change');
    await syncGoogleCalendarNow('change'); // arrives mid-sync
    useAppStore.setState({ customEvents: [{ id: 'new' } as never] }); // sources moved on meanwhile
    release();
    await first;
    expect(runSyncMock).toHaveBeenCalledTimes(2);
  });
  it('cancelling the second consent keeps a connect that has app.created', async () => {
    native.connect
      .mockResolvedValueOnce({ email: 'x@y', scopes: [APP] })
      .mockRejectedValueOnce(new Error('CANCELLED'));
    runSyncMock.mockResolvedValue({
      kind: 'ok',
      written: 1,
      state: {
        calendarId: 'c',
        held: {},
        lastSyncAt: 1,
        pastFillPending: false,
        reisDeleted: {},
        skipped: {},
      },
    });
    await connectGoogleCalendar();
    expect((await loadSyncState()).enabled).toBe(true);
  });
  it('does not sync while the schedule is still loading', async () => {
    await saveSyncState({
      enabled: true,
      calendarId: 'c',
      held: {},
      lastSyncAt: 1,
      pastFillPending: false,
      reisDeleted: {},
      skipped: {},
      sourcesFingerprint: null,
    });
    useAppStore.setState({ schedule: { data: [], status: 'loading' } } as never);
    await syncGoogleCalendarNow('change');
    expect(runSyncMock).not.toHaveBeenCalled();
  });
  it('revoked access turns the sync off with its own notice', async () => {
    await saveSyncState({
      enabled: true,
      calendarId: 'c',
      held: {},
      lastSyncAt: 1,
      pastFillPending: false,
      reisDeleted: {},
      skipped: {},
      sourcesFingerprint: null,
    });
    runSyncMock.mockResolvedValue({ kind: 'revoked' });
    await syncGoogleCalendarNow('change');
    expect((await loadSyncState()).enabled).toBe(false);
    expect(useAppStore.getState().gcal.notice).toBe('revoked');
  });
  it('a native REVOKED rejection reaches the runner as AuthRevokedError', async () => {
    await saveSyncState({
      enabled: true,
      calendarId: 'c',
      held: {},
      lastSyncAt: 1,
      pastFillPending: false,
      reisDeleted: {},
      skipped: {},
      sourcesFingerprint: null,
    });
    native.accessToken.mockRejectedValueOnce(
      Object.assign(new Error('REVOKED'), { code: 'REVOKED' })
    );
    runSyncMock.mockImplementation(async (o: { api: CalendarApi }) => {
      try {
        await o.api.assertCalendar('c');
        return { kind: 'calendarGone' };
      } catch (e) {
        return e instanceof AuthRevokedError ? { kind: 'revoked' } : { kind: 'calendarGone' };
      }
    });
    await syncGoogleCalendarNow('change');
    expect(useAppStore.getState().gcal.notice).toBe('revoked');
  });
  it('disconnect revokes at Google and forgets the state', async () => {
    await saveSyncState({
      enabled: true,
      calendarId: 'c',
      held: {},
      lastSyncAt: 1,
      pastFillPending: false,
      reisDeleted: {},
      skipped: {},
      sourcesFingerprint: null,
    });
    useAppStore.getState().setGcal({ connected: true, email: 'x@y' });
    await disconnectGoogleCalendar();
    expect(native.disconnect).toHaveBeenCalledTimes(1);
    expect((await loadSyncState()).enabled).toBe(false);
    expect(useAppStore.getState().gcal).toMatchObject({ connected: false, email: null });
  });
});
