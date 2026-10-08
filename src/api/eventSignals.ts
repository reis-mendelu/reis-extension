import { supabase } from '../services/spolky/supabaseClient';
import { IndexedDBService } from '../services/storage';
import { isDemoMode } from '../errors/demoMode';
import { isHarnessEnabled } from '../utils/harnessEnabled';
import { hasDataConsent } from '../utils/firefoxDataConsent';
import { logError } from '../utils/reportError';

/**
 * The three numbers an event carries in the admin console (spec 2026-10-08):
 * Seen (on screen in the Akce list, the peek band, a pin or Novinky), Opened
 * (its card), Link (Instagram / more info). Each is sent at most once per
 * DEVICE per event — the record of what was sent stays here in IndexedDB, so
 * the server gets an event id and nothing else, and never learns which device
 * looked at what. Gated like every counter: no demo, no harness (`check:app`
 * fails a build that writes), and Firefox's technicalAndInteraction consent.
 */
export type EventSignal = 'seen' | 'opened' | 'link';

const KEY = 'event_signal_sent';
let sent: Set<string> | null = null;
let loading: Promise<Set<string>> | null = null;

function loadSent(): Promise<Set<string>> {
  if (sent) return Promise.resolve(sent);
  loading ??= IndexedDBService.get('meta', KEY).then((v) => {
    sent = new Set(Array.isArray(v) ? (v as string[]) : []);
    return sent;
  });
  return loading;
}

/** Test-only: forget the in-memory record, as a new session would. */
export function __resetEventSignalsForTests(): void {
  sent = null;
  loading = null;
}

export async function trackEventSignal(eventId: string, signal: EventSignal): Promise<void> {
  if (isDemoMode() || isHarnessEnabled(import.meta.env)) return;
  const mark = `${signal}:${eventId}`;
  try {
    const record = await loadSent();
    if (record.has(mark)) return;
    // Latched before the awaits below, so two surfaces showing the same event
    // in one frame send it once; released again on any failure.
    record.add(mark);
    if (!(await hasDataConsent('technicalAndInteraction'))) {
      record.delete(mark);
      return;
    }
    const { error } = await supabase.rpc('increment_event_signal', { row_id: eventId, signal });
    if (error) {
      record.delete(mark);
      logError('Api.trackEventSignal', new Error(error.message));
      return;
    }
    await IndexedDBService.set('meta', KEY, [...record]);
  } catch (err) {
    sent?.delete(mark);
    logError('Api.trackEventSignal', err);
  }
}
