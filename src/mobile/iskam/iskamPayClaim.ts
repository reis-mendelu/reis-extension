import { ISKAM_ORIGIN } from './iskamJar';
import {
  INITIAL_PAY_STATE,
  asProbe,
  buildOpenDialogScript,
  buildProbeScript,
  nextPayStep,
  type PayAction,
} from './payScript';

const CLAIMS_PAGE = `${ISKAM_ORIGIN}/InformaceOKlientovi`;
const AUTH_SHIBB = `${ISKAM_ORIGIN}/Prihlaseni/AuthShibb`;
/** As the WebISKAM sign-in: the view only appears after its first page load. */
const FIRST_LOAD_TIMEOUT_MS = 30_000;
/** Long enough for the student to see the claim leave the page. */
const CLOSE_AFTER_PAID_MS = 600;

interface Handle {
  remove(): Promise<void>;
}

/**
 * Opens WebISKAM's claims page in the in-app web view, with its own "Uhradit"
 * dialog for this claim already open, and resolves when the view closes.
 * reIS sends nothing to pay: the student taps WebISKAM's own button, as they
 * would in a browser (payScript.ts).
 *
 * Each page load runs two scripts: the one that opens the dialog (needs nothing
 * from the app) and a probe that reports where the page is. The state of this
 * opening (sign-in steps taken, dialog seen, paid) lives here, not in the page,
 * and nextPayStep decides the rest: re-sign-in, and closing after paying.
 * The web view is the sign-in's, so it has the student's session; its
 * listeners are its own and removed on every exit.
 *
 * Rejects when WebISKAM does not load at all (no first page within
 * FIRST_LOAD_TIMEOUT_MS, or a failed first load): the view is shown only after
 * its first load, so otherwise nothing could be closed and Zaplatit would
 * stay disabled.
 */
export async function openClaimInIskam(claimId: string): Promise<void> {
  const probe = buildProbeScript(claimId);
  const openDialog = buildOpenDialogScript(claimId);
  const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
  const handles: Handle[] = [];
  let state = INITIAL_PAY_STATE;
  let loaded = false;
  let settled = false;

  await new Promise<void>((resolve, reject) => {
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      void Promise.allSettled(handles.map((h) => h.remove()));
      if (error === undefined) resolve();
      else reject(error);
    };
    const fail = (error: Error) => {
      void InAppBrowser.close().catch(() => undefined);
      finish(error);
    };
    const deadline = setTimeout(
      () => fail(new Error('WebISKAM did not load')),
      FIRST_LOAD_TIMEOUT_MS
    );
    const perform = (action: PayAction) => {
      if (action === 'auth') void InAppBrowser.setUrl({ url: AUTH_SHIBB }).catch(() => undefined);
      else if (action === 'claims')
        void InAppBrowser.setUrl({ url: CLAIMS_PAGE }).catch(() => undefined);
      else if (action === 'close') {
        setTimeout(() => {
          void InAppBrowser.close().catch(() => undefined);
          finish();
        }, CLOSE_AFTER_PAID_MS);
      }
    };

    void (async () => {
      try {
        handles.push(
          await InAppBrowser.addListener('browserPageLoaded', () => {
            loaded = true;
            clearTimeout(deadline);
            void InAppBrowser.executeScript({ code: openDialog }).catch(() => undefined);
            void InAppBrowser.executeScript({ code: probe }).catch(() => undefined);
          }),
          await InAppBrowser.addListener('messageFromWebview', (e) => {
            const p = asProbe(e.detail);
            if (!p) return;
            const step = nextPayStep(state, p);
            state = step.state;
            perform(step.action);
          }),
          await InAppBrowser.addListener('pageLoadError', () => {
            if (!loaded) fail(new Error('WebISKAM failed to load'));
          }),
          await InAppBrowser.addListener('closeEvent', () => finish())
        );
        if (settled) return;
        await InAppBrowser.openWebView({
          url: CLAIMS_PAGE,
          title: 'WebISKAM',
          isPresentAfterPageLoad: true,
        });
      } catch (e) {
        fail(e instanceof Error ? e : new Error(String(e)));
      }
    })();
  });
}
