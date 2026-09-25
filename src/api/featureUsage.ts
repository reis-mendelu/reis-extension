import { supabase } from '../services/spolky/supabaseClient';
import { isDemoMode } from '../errors/demoMode';
import { getInstallId } from '../services/identity/installId';
import { isHarnessEnabled } from '../utils/harnessEnabled';
import { logError } from '../utils/reportError';
import { hasDataConsent } from '../utils/firefoxDataConsent';

/**
 * The three counters reIS keeps about its own features, and the per-event map
 * view counter beside them.
 *
 * Both writes here identify the DEVICE or the EVENT, never the student. The
 * feature signals carry the random per-install UUID
 * (`services/identity/installId.ts`) and a fixed label; the map view carries an
 * event id and no identifier at all. They therefore count INSTALLS, not people
 * — one student on a phone and a laptop is two, and a reinstall is a third.
 * Any dashboard built on them must say so, exactly as the admin usage panel
 * already does. Disclosed in PRIVACY.md section 2 and
 * docs/privacy-policy-app.md before either write existed.
 *
 * What is deliberately NOT recorded: which event a given install looked at.
 * Pairing the install id with an event id would be a behavioural profile, so
 * the two counters are kept in separate shapes that cannot be joined.
 */
export type FeatureSignal =
  /** Spent at least three seconds on the campus map. */
  | 'map_dwell_3s'
  /** The app configured the eduroam network itself (iOS/Android). */
  | 'eduroam_wifi_configured'
  /** A profile was handed over, which the student must still install (mac/windows). */
  | 'eduroam_profile_delivered';

/**
 * Whether this build may write a counter at all.
 *
 * `check:app` builds the app and loads it in a real browser, failing the PR if
 * it writes to Supabase — and a dwell timer that fires three seconds after boot
 * is exactly that. A dev server and the deployed Vercel preview are not
 * installs either: `trackDailyUsage` measured the cost of missing this, with
 * all 164 rows ever labelled `platform = 'web'` written by a harness rather
 * than a student.
 */
function writesAllowed(): boolean {
  return !isDemoMode() && !isHarnessEnabled(import.meta.env);
}

/**
 * Latches, not booleans-after-the-fact: a signal already sent this session is
 * not sent again, but a FAILED write releases its latch so one bad moment of
 * campus wi-fi does not cost this install its place in the day's count. Same
 * reasoning as the in-flight promise in `api/feedback.ts`.
 */
const sentSignals = new Set<FeatureSignal>();
const viewedEvents = new Set<string>();

/** Test-only: drop the once-per-session latches. */
export function __resetFeatureSignalsForTests(): void {
  sentSignals.clear();
  viewedEvents.clear();
}

/**
 * Count this install for `signal`, at most once per app session.
 *
 * The session latch is what makes the number answer "how many installs did
 * this", rather than "how many times did it happen" — a student who leaves the
 * map and comes back five times is still one install that looked at the map.
 * The database keeps one row per install per day regardless, so a second
 * session tomorrow is counted and a second session today only bumps `hits`.
 */
export async function trackFeatureSignal(signal: FeatureSignal): Promise<void> {
  if (!writesAllowed()) return;
  if (sentSignals.has(signal)) return;
  sentSignals.add(signal);
  // Latched before the await so two concurrent calls cannot both send; released
  // when Firefox's technical-data toggle is off, so turning it on counts again.
  if (!(await hasDataConsent('technicalAndInteraction'))) {
    sentSignals.delete(signal);
    return;
  }
  try {
    const { error } = await supabase.rpc('track_feature_usage', {
      p_install_id: await getInstallId(),
      p_feature: signal,
    });
    if (error) {
      sentSignals.delete(signal);
      logError('Api.trackFeatureSignal', new Error(error.message));
    }
  } catch (err) {
    sentSignals.delete(signal);
    logError('Api.trackFeatureSignal', err);
  }
}

/**
 * Bump the map-view counter on one society event, at most once per session.
 *
 * The view lands in `event_map_views`, a rollup keyed on (event, day), NOT in
 * `view_count` — that is the Novinky feed metric
 * (`services/spolky/spolkyService.ts`), and folding map views into it would
 * silently corrupt a number societies are already shown. Keeping the day is
 * what lets the admin console draw a trend; a bare counter could only ever
 * answer "143 opens, ever".
 */
export async function trackMapEventView(eventId: string): Promise<void> {
  if (!writesAllowed()) return;
  if (viewedEvents.has(eventId)) return;
  viewedEvents.add(eventId);
  try {
    const { error } = await supabase.rpc('increment_event_map_view', { row_id: eventId });
    if (error) {
      viewedEvents.delete(eventId);
      logError('Api.trackMapEventView', new Error(error.message));
    }
  } catch (err) {
    viewedEvents.delete(eventId);
    logError('Api.trackMapEventView', err);
  }
}
