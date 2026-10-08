import {
  GoogleCalendarNative,
  SCOPE_APP_CREATED,
  SCOPE_CALENDAR_LIST,
} from './googleCalendarNative';
import { createCalendarApi } from './calendarApi';
import { AuthRevokedError } from './calendarHttp';
import { runSync, type SyncSources } from './runSync';
import { clearSyncState, loadSyncState, saveSyncState } from './syncStateStore';
import { sha256Hex } from './eventIdentity';
import { useAppStore } from '../../store/useAppStore';
import { isDemoMode } from '../../errors/demoMode';
import { logError } from '../../utils/reportError';

/**
 * Unchanged sources still re-sync after this. Under option B nothing in Google
 * is "repaired", but this is how a deleted Rozvrh or revoked access is noticed
 * when nothing in IS changes for weeks.
 */
const REVISIT_AFTER_MS = 6 * 3600_000;

let cachedToken: string | null = null;
let running = false;
let pending = false;

/** The native halves reject with "REVOKED" when the grant is gone. */
function isRevoked(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === 'REVOKED' || err?.message === 'REVOKED';
}

function api() {
  return createCalendarApi({
    token: async () => {
      if (cachedToken) return cachedToken;
      try {
        cachedToken = (await GoogleCalendarNative.accessToken()).token;
        return cachedToken;
      } catch (e) {
        if (isRevoked(e)) throw new AuthRevokedError('Google access was revoked');
        throw e;
      }
    },
    invalidateToken: async () => {
      if (cachedToken) await GoogleCalendarNative.invalidateToken({ token: cachedToken });
      cachedToken = null;
    },
    fetch: (...a) => fetch(...a),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  });
}

function currentSources(): SyncSources {
  const s = useAppStore.getState();
  return {
    language: s.language,
    lessons: s.schedule.data,
    lessonsConfirmed: s.schedule.status === 'success' && s.schedule.data.length > 0,
    exams: s.exams.data,
    // Subjects, not registrations: the list stays non-empty after deregistering.
    examsConfirmed: s.exams.status === 'success' && s.exams.data.length > 0,
    custom: s.customEvents,
  };
}

export async function sourcesFingerprint(src: SyncSources): Promise<string> {
  return sha256Hex(JSON.stringify([src.language, src.lessons, src.exams, src.custom]));
}

async function turnOff(notice: 'calendarGone' | 'revoked' | null) {
  // A grant revoked elsewhere can still sit in the native keychain with a
  // valid-looking token; forget it so the next connect shows Google's screen.
  if (notice === 'revoked') {
    await GoogleCalendarNative.disconnect().catch((e: unknown) =>
      logError('GoogleCalendar.forgetRevoked', e)
    );
  }
  await clearSyncState();
  cachedToken = null;
  useAppStore
    .getState()
    .setGcal({ connected: false, email: null, syncing: false, progress: null, notice });
}

export async function syncGoogleCalendarNow(reason: 'connect' | 'change'): Promise<void> {
  const st = await loadSyncState();
  if (!st.enabled || isDemoMode()) return;
  if (useAppStore.getState().schedule.status === 'loading') return; // the subscription fires when it lands
  if (running) {
    pending = true;
    return;
  }
  const sources = currentSources();
  const fp = await sourcesFingerprint(sources);
  const fresh = st.lastSyncAt !== null && Date.now() - st.lastSyncAt < REVISIT_AFTER_MS;
  if (reason === 'change' && fp === st.sourcesFingerprint && fresh) return;
  running = true;
  const set = useAppStore.getState().setGcal;
  set({ syncing: true, notice: null });
  try {
    const out = await runSync({
      api: api(),
      state: st,
      sources,
      now: new Date(),
      persist: (s) => saveSyncState({ ...s, enabled: true, sourcesFingerprint: null }),
      onProgress: (done, total) => set({ progress: total > 20 ? { done, total } : null }),
    });
    if (out.kind === 'calendarGone' || out.kind === 'revoked') {
      await turnOff(out.kind);
    } else {
      // A held-back delete needs a confirming second run, so don't let the
      // unchanged-sources shortcut skip it.
      const heldAny = Object.keys(out.state.held).length > 0;
      await saveSyncState({ ...out.state, enabled: true, sourcesFingerprint: heldAny ? null : fp });
      set({ lastSyncAt: out.state.lastSyncAt });
    }
  } catch (e) {
    logError('GoogleCalendar.sync', e, { reason });
    set({ notice: 'failed' });
  } finally {
    set({ syncing: false, progress: null });
    running = false;
  }
  if (pending) {
    pending = false;
    await syncGoogleCalendarNow('change');
  }
}

export async function connectGoogleCalendar(): Promise<void> {
  try {
    let { email, scopes } = await GoogleCalendarNative.connect();
    if (!scopes.includes(SCOPE_APP_CREATED)) {
      useAppStore.getState().setGcal({ notice: 'scopeMissing' });
      return;
    }
    // Granular consent: the calendar list was unticked. Ask once more; it only
    // helps a second device find the same "Rozvrh", so proceed either way.
    if (!scopes.includes(SCOPE_CALENDAR_LIST)) {
      const first = { email, scopes };
      ({ email, scopes } = await GoogleCalendarNative.connect().catch(() => first));
    }
    const st = await loadSyncState();
    await saveSyncState({ ...st, enabled: true, sourcesFingerprint: null });
    useAppStore.getState().setGcal({ connected: true, email, notice: null });
    await syncGoogleCalendarNow('connect');
  } catch (e) {
    logError('GoogleCalendar.connect', e); // includes the student cancelling the consent sheet
  }
}

/**
 * Turns the sync off and revokes reIS's access. "Rozvrh" stays in the student's
 * Google account (Dominik, 2026-10-08: on and off only); they can delete it in
 * Google Calendar themselves.
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  await GoogleCalendarNative.disconnect().catch((e: unknown) =>
    logError('GoogleCalendar.disconnect', e)
  );
  await turnOff(null);
}
