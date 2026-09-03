import { supabase } from '@/services/spolky/supabaseClient';
import { logError } from '@/utils/reportError';
import { getBrowserInfo } from '@/services/errorReporter/sanitize';
import { getAppVersion } from '@/utils/appIdentity';
import { IndexedDBService } from '@/services/storage';
import { isAppView, type AppView } from '@/types/app';
import type { SuggestionDraft, SuggestionPayload, SubmitResult } from '@/types/suggestions';

// The host URL is deliberately NOT sent: on IS it carries
// studium=/obdobi=/predmet=/termin=, which sanitize.ts redacts wholesale for
// telemetry. The screen is the useful half with none of the risk.
export function resolveScreen(raw: unknown): AppView {
  return isAppView(raw) ? raw : 'calendar';
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

/**
 * Writes a suggestion through the `submit_suggestion` RPC — the same shape
 * telemetry uses (`report_error_v2`), and for the same reason: an anonymous
 * write needs no shared secret.
 *
 * There is deliberately no client credential here. The old edge function gated
 * on `x-reis-extension-secret`, a value that shipped inside the bundle — so
 * anyone could unzip the extension and read it. A string every client carries
 * is an identifier, not a credential, and on a write-only insert it protected
 * nothing. Authorization is still enforced server-side and is unchanged:
 * `suggestions` is deny-all RLS with no insert grant to `anon`, so the RPC is
 * the only way a row can be written.
 *
 * The RPC returns false for both a validation failure and the flood guard, so
 * the two are no longer distinguishable from here — the old function's 400 vs
 * 429 split is gone. The client enforces the same limits with `maxLength`, so
 * an invalid payload from the real UI is not reachable; 'rate_limited' is the
 * honest guess for a false, and it is what the copy already tells the student.
 */
export async function submitSuggestion(draft: SuggestionDraft): Promise<SubmitResult> {
  try {
    const payload = buildSuggestionPayload(draft, await currentScreen());
    const { data, error } = await supabase.rpc('submit_suggestion', {
      p_type: payload.type,
      p_title: payload.title,
      p_body: payload.body,
      p_screen: payload.screen,
      p_contact: payload.contact ?? null,
      p_ext_version: payload.ext_version,
      p_browser_name: payload.browser_name,
      p_browser_version: payload.browser_version,
      p_viewport: payload.viewport,
    });
    if (error) {
      logError('Api.submitSuggestion', error);
      return { ok: false, error: 'upstream' };
    }
    return data === true ? { ok: true } : { ok: false, error: 'rate_limited' };
  } catch (err) {
    logError('Api.submitSuggestion', err);
    return { ok: false, error: 'offline' };
  }
}
