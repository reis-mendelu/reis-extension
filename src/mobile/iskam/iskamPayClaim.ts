import { ISKAM_ORIGIN } from './iskamJar';
import { buildPayScript } from './payScript';

const CLAIMS_PAGE = `${ISKAM_ORIGIN}/InformaceOKlientovi`;

interface Handle {
  remove(): Promise<void>;
}

/**
 * Opens WebISKAM's claims page in the in-app web view, with its own "Uhradit"
 * dialog for this claim already open, and resolves when the student closes
 * the view. reIS sends nothing to pay: the student taps WebISKAM's own button
 * in WebISKAM's own page, as they would in a browser (payScript.ts).
 *
 * The web view is the one the WebISKAM sign-in uses, so it has the student's
 * session (Android shares its cookies with the app's requests; on iOS it keeps
 * those from the sign-in, and a lapsed one goes through AuthShibb silently).
 * Its listeners are its own and removed on close: the sign-in registers the
 * same global events.
 */
export async function openClaimInIskam(claimId: string): Promise<void> {
  const code = buildPayScript(claimId, Math.random().toString(36).slice(2, 12) || 'n');
  const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
  const handles: Handle[] = [];
  const removeAll = () => Promise.allSettled(handles.map((h) => h.remove()));
  await new Promise<void>((resolve, reject) => {
    void (async () => {
      try {
        // One web view at a time (Zaplatit is disabled while this one is open,
        // and the sign-in is not running), so no per-view id filtering.
        handles.push(
          await InAppBrowser.addListener('browserPageLoaded', () => {
            void InAppBrowser.executeScript({ code }).catch(() => undefined);
          })
        );
        handles.push(await InAppBrowser.addListener('closeEvent', () => resolve()));
        await InAppBrowser.openWebView({
          url: CLAIMS_PAGE,
          title: 'WebISKAM',
          isPresentAfterPageLoad: true,
        });
      } catch (e) {
        reject(e);
      }
    })();
  }).finally(removeAll);
}
