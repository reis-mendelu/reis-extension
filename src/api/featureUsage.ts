import { supabase } from '../services/spolky/supabaseClient';
import { isDemoMode } from '../errors/demoMode';
import { getInstallId } from '../services/identity/installId';
import { isHarnessEnabled } from '../utils/harnessEnabled';
import { logError } from '../utils/reportError';
import { hasDataConsent } from '../utils/firefoxDataConsent';
import { claimFirstOpen, confirmOpen, releaseOpen } from '../services/spolky/countedOpens';
import { currentSchool } from '../utils/school';

/**
 * The counters reIS keeps about its own features, and the per-event map view
 * counter beside them.
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
export const FEATURE_SIGNALS = [
  /** Spent at least three seconds on the campus map. */
  'map_dwell_3s',
  /** The app configured the eduroam network itself (iOS/Android). */
  'eduroam_wifi_configured',
  /** A profile was handed over, which the student must still install (mac/windows). */
  'eduroam_profile_delivered',
  /** Týden was on screen on the phone or iPad (spec 2026-10-30). */
  'calendar_week_view',
  /*
   * One per screen, fired when it is SHOWN, on both trees (2026-11-07), so the
   * admin console can say "10 % of the day's installs opened Vývěska". Pinned
   * to their call sites by src/test/guards/screenSignalsHaveBothTrees.test.ts,
   * which also says why the map has none (`map_dwell_3s` answers it).
   */
  /** The calendar (phone tab, extension view). The default on the phone, so near 100 % there. */
  'screen_calendar',
  /** Předměty. */
  'screen_subjects',
  /** Jídelníček opened: the phone's sheet, the extension's chef-hat popover. */
  'screen_menu',
  /** A search surface opened. */
  'screen_search',
  /** Vývěska: the IS posts behind the pin. Not Novinky. */
  'screen_bulletin',
  /** Novinky: the feed behind the bell. */
  'screen_notifications',
  /** Zkoušky: the phone's tab, the extension's `exams` view. */
  'screen_exams',
  /** Studijní plán: one page, hosted by both trees. */
  'screen_study_plan',
  /** Doklady: the phone's sheet, the extension's drawer. */
  'screen_documents',
  /** ISIC balance sheet. Phone/iPad only, by decision (desktopHasNoIskam.test.ts). */
  'screen_isic',
  /** The library study-rooms card on the phone map. Phone/iPad only (desktopHasNoLibraryBooking.test.ts). */
  'screen_library',
  /** Stáže opened: the denominator for the click count below. Seen only by students a partner is shown to. */
  'screen_internships',
  /**
   * A click on a partner programme's card in Stáže, one label per programme
   * because the count is handed to that partner (2026-11-17: EY's "Cesta s EY").
   * A partner's label is added with its programme, never shared: a migration
   * widens the whitelist, so each is a deliberate step.
   */
  'internship_click_ey',
  /** "Nová verze reISu" tapped in Novinky (phone/iPad): how many outdated installs went to update. */
  'app_update_opened',
  /**
   * The "Studijní opory" link under Předměty (both trees) tapped. One label per
   * partner, since the count is handed to that partner: mendelu.app's, shown by
   * programme from the admin console (2026-11-18).
   */
  'study_aids_click_mendelu_app',
  /** The "reIS v Claude" row in the extension's Novinky opened its guide: how many installs went to set it up. */
  'reis_for_claude_guide_opened',
  /** The critical-version pop-up appeared (phone/iPad; at most twice per install, utils/criticalUpdate). */
  'critical_update_shown',
  /** Its Update button, or the one on an empty screen, tapped: did the explanation get students to update? */
  'critical_update_opened',
] as const;

/** Each label must also be in the database whitelist (featureSignalWhitelist.test.ts). */
export type FeatureSignal = (typeof FEATURE_SIGNALS)[number];

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
  // A school without the counters (VŠE at launch) sends reIS nothing at all.
  if (!currentSchool.has('usageCounts')) return false;
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
 *
 * Resolves `false` only when the write was attempted and failed — the one case
 * a caller may want to retry later (the support question's "yes" does). Every
 * other outcome, including a build that never writes and declined consent, is
 * settled and resolves `true`.
 */
export async function trackFeatureSignal(signal: FeatureSignal): Promise<boolean> {
  if (!writesAllowed()) return true;
  if (sentSignals.has(signal)) return true;
  sentSignals.add(signal);
  // Latched before the await so two concurrent calls cannot both send; released
  // when Firefox's technical-data toggle is off, so turning it on counts again.
  if (!(await hasDataConsent('technicalAndInteraction'))) {
    sentSignals.delete(signal);
    return true;
  }
  try {
    const { error } = await supabase.rpc('track_feature_usage_v2', {
      p_install_id: await getInstallId(),
      p_feature: signal,
      p_school: currentSchool.id,
    });
    if (error) {
      sentSignals.delete(signal);
      logError('Api.trackFeatureSignal', new Error(error.message));
      return false;
    }
    return true;
  } catch (err) {
    sentSignals.delete(signal);
    logError('Api.trackFeatureSignal', err);
    return false;
  }
}

/**
 * Bump the map-view counter on one society event, once per DEVICE.
 *
 * The session latch below only keeps one launch from counting twice; the
 * on-device memory (`claimFirstOpen`) is what makes the number "devices that
 * opened this event" rather than "opens". Once per device per event EVER, not
 * per day, even though the rollup row is per day: the day column exists for the
 * trend of FIRST opens, and a second visit tomorrow is the same device. No
 * identifier is added — the memory never leaves the device, so the request is
 * still an event id and nothing else.
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
  // Gated although it carries no identifier: Mozilla counts interaction metrics
  // as technicalAndInteraction data, and the student opened a card, not a
  // counter — the card works without it, so this is no implicit-consent send.
  // Asked BEFORE the device memory, so a refusal does not use up the one count.
  if (!(await hasDataConsent('technicalAndInteraction'))) {
    viewedEvents.delete(eventId);
    return;
  }
  // Already counted on an earlier launch: keep the session latch so the next tap
  // does not even reach the memory.
  if (!(await claimFirstOpen('map_open', eventId))) return;
  try {
    const { error } = await supabase.rpc('increment_event_map_view', { row_id: eventId });
    if (error) {
      viewedEvents.delete(eventId);
      releaseOpen('map_open', eventId);
      logError('Api.trackMapEventView', new Error(error.message));
    } else {
      await confirmOpen('map_open', eventId);
    }
  } catch (err) {
    viewedEvents.delete(eventId);
    releaseOpen('map_open', eventId);
    logError('Api.trackMapEventView', err);
  }
}
