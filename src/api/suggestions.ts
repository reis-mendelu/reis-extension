import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '@/services/supabase/config';
import { logError } from '@/utils/reportError';
import { getBrowserInfo } from '@/services/errorReporter/sanitize';
import { getAppVersion } from '@/utils/appIdentity';
import { IndexedDBService } from '@/services/storage';
import type { AppView } from '@/types/app';
import type { SuggestionDraft, SuggestionPayload, SubmitResult } from '@/types/suggestions';

const ENDPOINT = `${SUPABASE_URL}/functions/v1/submit-suggestion`;

// Exactly the AppView union. The host URL is deliberately NOT sent: on IS it
// carries studium=/obdobi=/predmet=/termin=, which sanitize.ts redacts wholesale
// for telemetry. The screen is the useful half with none of the risk.
const SCREENS: readonly AppView[] = [
  'calendar',
  'exams',
  'settings',
  'timeline-demo',
  'subjects',
  'studyPlan',
  'erasmus',
  'iskam-dashboard',
  'map',
];

export function resolveScreen(raw: unknown): AppView {
  return SCREENS.includes(raw as AppView) ? (raw as AppView) : 'calendar';
}

export function buildSuggestionPayload(draft: SuggestionDraft, screen: AppView): SuggestionPayload {
  const browser = getBrowserInfo();
  return {
    ...draft,
    screen,
    // getAppVersion, not the extension manifest alone: off the extension — the
    // whole phone app — the manifest is unavailable and a local fallback would
    // label every report from a phone '0.0.0'.
    ext_version: getAppVersion(),
    browser_name: browser.name,
    browser_version: browser.version,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

// The current screen is read from the key useAppLogic already persists on every
// view change. Reading it here keeps FeedbackModal working identically on
// desktop and in the mobile sheet stack, which has no route prop to drill.
async function currentScreen(): Promise<AppView> {
  try {
    return resolveScreen(await IndexedDBService.get('meta', 'reis_current_view'));
  } catch {
    return 'calendar';
  }
}

export async function submitSuggestion(draft: SuggestionDraft): Promise<SubmitResult> {
  try {
    const payload = buildSuggestionPayload(draft, await currentScreen());
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'x-reis-extension-secret': import.meta.env.VITE_EXTENSION_SECRET || 'reis-secret',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { ok: true };
    if (res.status === 429) return { ok: false, error: 'rate_limited' };
    if (res.status === 400) return { ok: false, error: 'invalid' };
    return { ok: false, error: 'upstream' };
  } catch (err) {
    logError('Api.submitSuggestion', err);
    return { ok: false, error: 'offline' };
  }
}
