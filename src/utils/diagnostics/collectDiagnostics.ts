import { getPlatform } from '@/platform';
import { executeAction } from '@/api/proxyClient';
import { useAppStore } from '@/store/useAppStore';
import { getDiagnostics, DIAGNOSTIC_CAP, type DiagnosticEntry } from './diagnosticLog';

/**
 * What "Přiložit technické údaje" attaches: the session's cleaned errors and
 * warnings, plus the environment and sync state as flags, timestamps and
 * counts. Never content — not a subject, an exam, a URL or an id.
 */
export interface DiagnosticsPayload {
  entries: DiagnosticEntry[];
  env: {
    platform: 'extension' | 'ios' | 'android' | 'web';
    os: string;
    lang: 'cz' | 'en';
    online: boolean;
    uptimeS: number;
  };
  sync: {
    lastSync: number | null;
    isSyncing: boolean;
    schedule: string;
    exams: string;
    scheduleCount: number;
    examsCount: number;
    examsFetchedAt: number | null;
  };
}

const CONTENT_TIMEOUT_MS = 1500;

/** OS family and, where the UA carries one, the major version. */
export function osOf(ua: string): string {
  let m: RegExpMatchArray | null;
  // safe: each regex has exactly one required capturing group
  if ((m = ua.match(/(?:iPhone )?OS (\d+)_\d+ like Mac OS X/))) return `iOS ${m[1]!}`;
  if ((m = ua.match(/Android (\d+)/))) return `Android ${m[1]!}`;
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux|X11/.test(ua)) return 'Linux';
  return 'unknown';
}

async function platformOf(): Promise<DiagnosticsPayload['env']['platform']> {
  const kind = getPlatform().kind;
  if (kind !== 'capacitor') return kind;
  // Lazy for the same reason as api/personPhoto: keeps @capacitor/core out of
  // the extension's static graph.
  const { Capacitor } = await import('@capacitor/core');
  const p = Capacitor.getPlatform();
  return p === 'ios' || p === 'android' ? p : 'web';
}

async function contentEntries(
  fetchContent: () => Promise<DiagnosticEntry[]>,
  timeoutMs: number
): Promise<DiagnosticEntry[]> {
  // Only the extension has a content script. Elsewhere nothing would answer and
  // the form would wait out the timeout for nothing.
  if (getPlatform().kind !== 'extension') return [];
  const timeout = new Promise<DiagnosticEntry[]>((resolve) => setTimeout(() => resolve([]), timeoutMs));
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
    },
  };
}
