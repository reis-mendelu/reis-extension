import { supabase } from '../services/spolky/supabaseClient';
import { isDemoMode } from '../errors/demoMode';
import { getInstallId } from '../services/identity/installId';
import { getPlatform } from '../platform';
import { getUserParams } from '../utils/userParams';
import { usagePlatform, type UsagePlatform } from '../utils/usagePlatform';
import { isHarnessEnabled } from '../utils/harnessEnabled';

/**
 * Both writes here identify the DEVICE, never the student.
 *
 * They used to send `SHA-256(studentId)`, which reads as anonymisation and is
 * not: IS student ids are six or seven digits, so the whole preimage space is
 * under ten million and a rainbow table reverses the digest in seconds. That
 * made every row a recoverable student identifier sitting in Supabase, which is
 * the exact opposite of reIS's promise that student data stays on the device.
 *
 * The replacement is a random per-install UUID (see services/identity). The
 * consequence is deliberate and must be read that way in any dashboard built on
 * these tables: they count INSTALLS, not people. One student on a phone and a
 * laptop is two rows, and a reinstall is a third. Where a per-person number is
 * needed, ask the student — an estimate that can be defended beats an exact
 * number that cannot.
 */
export async function submitFeedback(
  feedbackType: 'nps' | 'one_change',
  value: string,
  semesterCode: string,
  reason?: string
): Promise<boolean> {
  // Demo mode is a fabricated student; its feedback would pollute real rows.
  if (isDemoMode()) return false;

  const { error } = await supabase.rpc('submit_feedback', {
    p_student_id: await getInstallId(),
    p_faculty_id: null,
    p_study_semester: null,
    p_feedback_type: feedbackType,
    p_value: value,
    p_semester_code: semesterCode,
    p_reason: reason ?? null,
  });
  if (error) return false;

  return true;
}

/**
 * One write per page session, memoised the same way `getInstallId` is.
 *
 * `initializeStore()` is fire-and-forgotten from a bare `useEffect(..., [])` in
 * `hooks/useAppLogic.ts`, under <StrictMode> — which double-invokes effects in
 * development builds. One boot therefore filed two `track_daily_usage` calls,
 * and `open_count` came out at roughly twice the real number: over 2026-09-02..05
 * the counts were 850 rows at exactly 2 and 315 at exactly 4, against 17 at 1
 * and 5 at 3. Guarding here rather than around `initializeStore` is deliberate:
 * that function also installs the sync subscription, and StrictMode tears the
 * first one down before the second effect runs, so an early return there can
 * leave the app with no subscription at all.
 *
 * Holding the PROMISE rather than a boolean matters: a plain latch set before
 * the write would also swallow a retry after a failure, so one bad moment of
 * campus wi-fi at boot would cost that device its place in the day's count —
 * a silent undercount of real students, which is the thing this whole change
 * exists to stop. Concurrent callers share the in-flight promise; a rejected
 * one clears itself, exactly as `services/identity/installId.ts` does.
 */
let inFlight: Promise<void> | null = null;

/** Test-only: drop the once-per-session memo. */
export function __resetUsageTrackedForTests(): void {
  inFlight = null;
}

/**
 * Faculty and platform are GROUP labels (six faculties, four platforms) on
 * the same random install id — a count, not a record. Disclosed in
 * PRIVACY.md ("Daily Usage & NPS Feedback").
 */
export function trackDailyUsage(): Promise<void> {
  if (isDemoMode()) return Promise.resolve();

  // A dev server and the deployed preview are not installs, and counting them
  // is not a rounding error. `npm run dev:web` has no demo-mode guard — only
  // the preview build sets that flag (dev/earlyDemoMode.ts) — so every local
  // boot filed a real row against production Supabase, and every fresh browser
  // profile (each headless context in a `verify-ui` sweep) minted a new install
  // id, arriving in the admin console as another "unique install". Measured
  // 2026-09-15: all 164 rows ever labelled `platform = 'web'` were written this
  // way, none by a student.
  if (isHarnessEnabled(import.meta.env)) return Promise.resolve();

  if (!inFlight) {
    inFlight = writeDailyUsage().catch(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function writeDailyUsage(): Promise<void> {
  const faculty = (await getUserParams())?.facultyLabel ?? null;
  const kind = getPlatform().kind;
  // @capacitor/core imported lazily, and only on the capacitor branch, so the
  // extension bundle never pulls it in — the same reason client.ts's
  // fetchWithAuth does the same dynamic import.
  let platform: UsagePlatform;
  if (kind === 'capacitor') {
    const { Capacitor } = await import('@capacitor/core');
    platform = usagePlatform(kind, () => Capacitor.getPlatform());
  } else {
    platform = usagePlatform(kind, () => 'web');
  }

  const { error } = await supabase.rpc('track_daily_usage', {
    p_student_id: await getInstallId(),
    p_faculty: faculty,
    p_platform: platform,
  });
  // Thrown, not swallowed: the caller above clears the memo on a rejection so
  // a later call can still count this device. Nothing about the failure is
  // reported anywhere — see the Error Reporting section of CLAUDE.md.
  if (error) throw new Error('track_daily_usage failed');
}
