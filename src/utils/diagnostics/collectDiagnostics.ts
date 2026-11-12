import { getPlatform } from '@/platform';
import { osOf, platformOf, type ReportPlatform } from '@/utils/reportEnvironment';
import { executeAction } from '@/api/proxyClient';
import { useAppStore } from '@/store/useAppStore';
import { getDiagnostics, DIAGNOSTIC_CAP, type DiagnosticEntry } from './diagnosticLog';

/**
 * What "Přiložit technické údaje" / "Odeslat s technickými údaji" attaches: the session's cleaned errors and
 * warnings, plus the environment and sync state as flags, timestamps and
 * counts. Never content — not a subject, an exam, a URL or an id.
 */
export interface DiagnosticsPayload {
  entries: DiagnosticEntry[];
  env: {
    platform: ReportPlatform;
    os: string;
    lang: 'cz' | 'en';
    online: boolean;
    uptimeS: number;
  };
  sync: {
    /** When the last run ENDED — a run that reached nothing still stamps it. */
    lastSync: number | null;
    isSyncing: boolean;
    /** The store slices' status. For exams that is the IndexedDB cache read,
     *  so "success" with a count of 0 does NOT mean IS answered "no exams" —
     *  `syncLoaded` says what a sync actually got an answer for. */
    schedule: string;
    exams: string;
    scheduleCount: number;
    examsCount: number;
    examsFetchedAt: number | null;
    // Optional: 5.3.0 builds send the payload without them, and the admin
    // console parses every stored row with the same type.
    /** A sync run has finished this session. Latched. */
    firstSyncSettled?: boolean;
    /** Domains a sync got an answer for at any point THIS SESSION, empty
     *  answers included — cumulative, not the last run's. */
    syncLoaded?: string[];
    /** The last FINISHED run failed. Cleared the moment the next run starts,
     *  so it reads false while a retry is in flight. A flag only: the message
     *  is String(e), uncleaned. */
    syncFailed?: boolean;
    // Optional: builds up to 5.6.0 send none of these. Each one is a count of
    // what a "report missing" link covers (reportPrefill.ts), so a report of
    // an empty list can be read against what the app actually held.
    /** 'none' (never loaded), 'loading' or 'success'. A store read, like the
     *  others: `syncLoaded` holds whether a sync answered for subjects. */
    subjects?: string;
    subjectsCount?: number;
    /** Syllabuses held in the store, and of those how many have neither text
     *  nor table. Counts CACHED entries only: a subject whose syllabus never
     *  arrived (a failed fetch) also shows "no data" and is not counted here —
     *  `Sync.syllabus` in the entries counts those failures. */
    syllabusCount?: number;
    syllabusEmpty?: number;
    /** Zápisník records held; `null` ones are failed fetches, empty ones have
     *  no section and no test. */
    zaznamnikCount?: number;
    zaznamnikFailed?: number;
    zaznamnikEmpty?: number;
  };
}

const CONTENT_TIMEOUT_MS = 1500;

async function contentEntries(
  fetchContent: () => Promise<DiagnosticEntry[]>,
  timeoutMs: number
): Promise<DiagnosticEntry[]> {
  // Only the extension has a content script. Elsewhere nothing would answer and
  // the form would wait out the timeout for nothing.
  if (getPlatform().kind !== 'extension') return [];
  const timeout = new Promise<DiagnosticEntry[]>((resolve) =>
    setTimeout(() => resolve([]), timeoutMs)
  );
  try {
    return await Promise.race([fetchContent(), timeout]);
  } catch {
    return [];
  }
}

async function askContentScript(): Promise<DiagnosticEntry[]> {
  const r = await executeAction<{ entries?: DiagnosticEntry[] }>('get_diagnostics', {});
  return Array.isArray(r?.entries) ? r.entries : [];
}

export async function collectDiagnostics(
  deps: { fetchContent?: () => Promise<DiagnosticEntry[]>; timeoutMs?: number } = {}
): Promise<DiagnosticsPayload> {
  const content = await contentEntries(
    deps.fetchContent ?? askContentScript,
    deps.timeoutMs ?? CONTENT_TIMEOUT_MS
  );
  const entries = [...getDiagnostics(), ...content]
    .sort((a, b) => a.t - b.t)
    .slice(-DIAGNOSTIC_CAP);
  const s = useAppStore.getState();
  return {
    entries,
    env: {
      platform: await platformOf(),
      os: osOf(navigator.userAgent),
      lang: s.language,
      online: navigator.onLine,
      uptimeS: Math.round(performance.now() / 1000),
    },
    sync: {
      lastSync: s.syncStatus?.lastSync ?? null,
      isSyncing: s.isSyncing,
      schedule: s.schedule.status,
      exams: s.exams.status,
      scheduleCount: s.schedule.data.length,
      examsCount: s.exams.data.length,
      examsFetchedAt: s.lastExamsFetchedAt,
      firstSyncSettled: s.firstSyncSettled,
      syncLoaded: Object.entries(s.syncLoaded ?? {})
        .filter(([, v]) => v)
        .map(([k]) => k),
      syncFailed: !!s.syncStatus?.error,
      ...heldCounts(s),
    },
  };
}

type Store = ReturnType<typeof useAppStore.getState>;

/**
 * Counts only. Never which subject: no key of these maps leaves here. Runs
 * inside Send, so it must not throw: a record of an unexpected shape (one
 * hydrated from an older build) drops these fields, never the report.
 */
function heldCounts(s: Store) {
  try {
    // The store holds one language per subject: createSyllabusSlice unwraps
    // IndexedDB's { cz, en } before caching.
    const syllabuses = Object.values(s.syllabuses?.cache ?? {});
    const zaznamnik = Object.values(s.zaznamnik ?? {});
    return {
      subjects: s.subjectsLoading ? 'loading' : s.subjects ? 'success' : 'none',
      subjectsCount: Object.keys(s.subjects?.data ?? {}).length,
      syllabusCount: syllabuses.length,
      syllabusEmpty: syllabuses.filter((y) => !y?.requirementsText && !y?.requirementsTable?.length)
        .length,
      zaznamnikCount: zaznamnik.length,
      zaznamnikFailed: zaznamnik.filter((z) => z === null).length,
      zaznamnikEmpty: zaznamnik.filter(
        (z) => z !== null && !z?.ph?.sections?.length && !z?.vt?.tests?.length
      ).length,
    };
  } catch {
    return {};
  }
}
