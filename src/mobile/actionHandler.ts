import { Messages, isIframeMessage } from '../types/messages';
import type { ActionResultMessage } from '../types/messages/base';
import { sendToIframe } from '../injector/iframeManager';

/**
 * The app-side responder for `REIS_ACTION`.
 *
 * In the extension the CONTENT SCRIPT answers these (`injector/messageHandler`).
 * Capacitor has no content script, so every action posted by the app went
 * unanswered and sat until the 30 s `REQUEST_TIMEOUT` — which is why tapping a
 * study document spun and then showed an error.
 *
 * This deliberately does NOT reuse `messageHandler`'s switch, despite the two
 * looking parallel. Only the pure in-process cases are genuinely shared; the
 * ones that matter here are DOM-bound in the content script (an `a[download]`
 * save, `window.open`, a logout form POST) and have no meaning in the app. It
 * also keeps `messageHandler`'s module-scope `chrome.runtime.getURL` out of the
 * mobile bundle, where it would throw on import.
 */
export interface MobileActionDeps {
  /** Native fetch + platform-appropriate delivery. See mobile/openIsFile. */
  downloadDocument(url: string, filename: string): Promise<void>;
  refreshExams(): Promise<void>;
  syncAllData(): Promise<void>;
}

/**
 * Only four of the eleven actions in `ActionType` are reachable from the app:
 * `register_exam`/`unregister_exam` are called in-process by `useExamActions`,
 * `open_url` has no callers, `toggle_outlook_sync`/`download_file` have no case
 * on any platform, and the Drive actions are broken on mobile (#168).
 *
 * Everything unhandled throws IMMEDIATELY and names itself. That default is
 * half the value of this module: an unsupported action used to be
 * indistinguishable from a network fault, because both looked like a 30 s hang
 * ending in a generic error.
 */
export async function runMobileAction(
  action: string,
  payload: unknown,
  deps: MobileActionDeps
): Promise<unknown> {
  const p = (payload ?? {}) as Record<string, string | undefined>;

  switch (action) {
    case 'download_document': {
      // Validate before the network call so a malformed payload fails as a
      // payload error, not as a mysterious IS response.
      if (!p.url) throw new Error('download_document: missing url');
      if (!p.filename) throw new Error('download_document: missing filename');
      await deps.downloadDocument(p.url, p.filename);
      return { success: true };
    }
    case 'refresh_exams':
      await deps.refreshExams();
      return { success: true };
    case 'trigger_sync':
      await deps.syncAllData();
      return { success: true };
    default:
      throw new Error(`Action "${action}" is not available in the reIS mobile app`);
  }
}

/**
 * Handles one `message` event. Split from the listener so it can be tested
 * without a DOM: `ownWindow` is the identity check that on a top-level window
 * (`window.parent === window`) admits only our own posts.
 *
 * Never throws — a rejected action must come back as `success: false` so the
 * caller's promise settles. Throwing here would leave it hanging, which is the
 * exact failure this module exists to remove.
 */
export async function handleMobileActionMessage(
  event: MessageEvent,
  ownWindow: Window,
  deps: MobileActionDeps,
  reply: (message: ActionResultMessage) => void
): Promise<void> {
  if (event.source !== ownWindow) return;
  const data = event.data;
  if (!isIframeMessage(data)) return;
  if (data.type !== 'REIS_ACTION') return;

  try {
    const result = await runMobileAction(data.action, data.payload, deps);
    reply(Messages.actionResult(data.id, true, result));
  } catch (e) {
    reply(Messages.actionResult(data.id, false, undefined, String(e)));
  }
}

/**
 * Wires the handler to the real window. Called from `main.capacitor.ts` before
 * the React root is imported, so an action fired during first paint is not lost.
 *
 * The imports are dynamic to match how `main.capacitor.ts` already loads
 * `syncService`: statically importing it here would pull the whole sync graph
 * into the boot chunk before a session exists.
 */
export function installMobileActionHandler(): void {
  const deps: MobileActionDeps = {
    downloadDocument: async (url, filename) => {
      const { openIsFileNatively } = await import('./openIsFile');
      await openIsFileNatively(url, filename);
    },
    refreshExams: async () => {
      const { refreshExams } = await import('../injector/syncService');
      await refreshExams();
    },
    syncAllData: async () => {
      const { syncAllData } = await import('../injector/syncService');
      await syncAllData();
    },
  };

  window.addEventListener('message', (event: MessageEvent) => {
    void handleMobileActionMessage(event, window, deps, sendToIframe);
  });
}
