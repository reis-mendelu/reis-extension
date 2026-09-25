import { supabase } from '@/services/spolky/supabaseClient';
import { logError } from '@/utils/reportError';
import { getBrowserInfo } from '@/utils/browserInfo';
import { getAppVersion } from '@/utils/appIdentity';
import { IndexedDBService } from '@/services/storage';
import { isAppView, type AppView } from '@/types/app';
import type {
  SuggestionDraft,
  SuggestionPayload,
  SubmitResult,
  SuggestionAttachmentsDraft,
} from '@/types/suggestions';

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
 * Writes a suggestion through the `submit_suggestion_v2` RPC: a SECURITY
 * DEFINER function granted to `anon`, because an anonymous write needs no
 * shared secret. This is the ONLY thing reIS sends that a student composed.
 * v1 (`submit_suggestion`) stays deployed for builds that have not updated.
 *
 * `attachments` is what the student chose to add: a screenshot they picked and,
 * only if they ticked the box, the cleaned diagnostics. Neither
 * is ever gathered here on its own initiative. The install id is deliberately
 * not sent, so a report cannot be joined to the daily-usage rows.
 *
 * There is deliberately no client credential here. A string every client
 * carries is an identifier, not a credential. Authorization is enforced
 * server-side: `suggestions` and `suggestion_attachments` are deny-all RLS with
 * no insert grant to `anon`, so the RPC is the only way a row can be written.
 *
 * The RPC answers `ok`, `ok_without_screenshot` (the text and diagnostics were
 * kept but the image was refused — malformed, oversized, not a JPEG, or the
 * hourly screenshot budget is spent) or `rejected` (validation or the flood
 * guard — not distinguishable from here; 'rate_limited' is the honest guess,
 * and it is what the copy already tells the student).
 */
export async function submitSuggestion(
  draft: SuggestionDraft,
  attachments: SuggestionAttachmentsDraft = {}
): Promise<SubmitResult> {
  try {
    const payload = buildSuggestionPayload(draft, await currentScreen());
    const screenshot = attachments.screenshotBase64 ?? null;
    const { data, error } = await supabase.rpc('submit_suggestion_v2', {
      p_type: payload.type,
      p_title: payload.title,
      p_body: payload.body,
      p_screen: payload.screen,
      p_contact: payload.contact ?? null,
      p_ext_version: payload.ext_version,
      p_browser_name: payload.browser_name,
      p_browser_version: payload.browser_version,
      p_viewport: payload.viewport,
      p_diagnostics: attachments.diagnostics ?? null,
      p_screenshot: screenshot,
    });
    if (error) {
      logError('Api.submitSuggestion', error);
      return { ok: false, error: 'upstream' };
    }
    if (data === 'ok') return { ok: true };
    if (data === 'ok_without_screenshot') {
      return screenshot ? { ok: true, screenshotDropped: true } : { ok: true };
    }
    return { ok: false, error: 'rate_limited' };
  } catch (err) {
    logError('Api.submitSuggestion', err);
    return { ok: false, error: 'offline' };
  }
}
