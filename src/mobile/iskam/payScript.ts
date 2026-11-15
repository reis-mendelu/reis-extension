const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function claimLiteral(claimId: string): string {
  if (!GUID.test(claimId)) throw new Error('claim id is not a GUID');
  return JSON.stringify(claimId);
}

/**
 * Injected on every page load of the pay web view. It only REPORTS where the
 * page is, through the plugin's bridge, and keeps no state: what to do next is
 * decided in the app (nextPayStep), which keeps the state for this opening.
 */
export function buildProbeScript(claimId: string): string {
  return `(function () {
  var ID = ${claimLiteral(claimId)};
  if (location.hostname !== 'webiskam.mendelu.cz') return;
  if (!window.mobileApp || !window.mobileApp.postMessage) return;
  window.mobileApp.postMessage({
    reisClaimProbe: true,
    path: location.pathname,
    hasClaim: !!document.querySelector('.payfrommainaccount[data-id="' + ID + '"]'),
    claimsPage: !!document.getElementById('ZaplatitZKonta')
  });
})();`;
}

/**
 * Injected on every page load, beside the probe, needing no bridge: the part
 * proven on a device (Pixel 9a, 2026-11-15). Without the claim on the page it
 * does nothing, so it never needs to know where it is.
 *
 * Presses the claim's € button, which opens WebISKAM's own "Uhradit" dialog —
 * what the student could do with a finger. Paying is the dialog's button, and
 * only the student presses that: this sends no form and never presses it
 * (src/test/guards/iskamNeverPays.test.ts reads this file). A dialog that did
 * not pick up this claim's id is closed again.
 */
export function buildOpenDialogScript(claimId: string): string {
  return `(function () {
  var ID = ${claimLiteral(claimId)};
  if (location.hostname !== 'webiskam.mendelu.cz') return;
  var btn = document.querySelector('.payfrommainaccount[data-id="' + ID + '"]');
  if (!btn) return;
  btn.click();
  setTimeout(function () {
    var f = document.getElementById('IDPolozky');
    if (!f || f.value !== ID) {
      if (window.jQuery) window.jQuery('#ZaplatitZKonta').modal('hide');
    }
  }, 500);
})();`;
}

export interface PayProbe {
  path: string;
  hasClaim: boolean;
  claimsPage: boolean;
}

export interface PayState {
  hops: number;
  reached: boolean;
  opened: boolean;
  done: boolean;
}

export type PayAction = 'none' | 'auth' | 'claims' | 'close';

export const INITIAL_PAY_STATE: PayState = { hops: 0, reached: false, opened: false, done: false };

/** A bridge message is page-sent data: only this exact shape counts. */
export function asProbe(detail: unknown): PayProbe | null {
  if (!detail || typeof detail !== 'object') return null;
  const d = detail as Record<string, unknown>;
  if (d.reisClaimProbe !== true || typeof d.path !== 'string') return null;
  return { path: d.path, hasClaim: d.hasClaim === true, claimsPage: d.claimsPage === true };
}

/**
 * What the pay view does after a page reported itself.
 *
 * - On the claims page with the claim: its dialog is opened by the open
 *   script on every load; here it is only remembered that this view had it.
 * - On the signed-in claims page WITHOUT the claim this view opened: it was
 *   paid. WebISKAM reloads silently after paying (seen 2026-11-15), so the view
 *   closes and reIS re-reads the balance and says so (iskamStore).
 * - Anywhere else before the claims page was reached: the session lapsed, so
 *   the sign-in (AuthShibb, silent while the MENDELU sign-in lives), then the
 *   claims page — two steps at most. After it was reached, never navigate.
 */
export function nextPayStep(
  state: PayState,
  probe: PayProbe
): { state: PayState; action: PayAction } {
  if (state.done) return { state, action: 'none' };
  if (/^\/InformaceOKlientovi\/?$/i.test(probe.path)) {
    const reached = { ...state, reached: true };
    if (probe.hasClaim) return { state: { ...reached, opened: true }, action: 'none' };
    if (state.opened && probe.claimsPage) {
      return { state: { ...reached, done: true }, action: 'close' };
    }
    return { state: reached, action: 'none' };
  }
  if (state.reached) return { state, action: 'none' };
  if (/^\/(Prihlaseni|Shibboleth\.sso)/i.test(probe.path)) return { state, action: 'none' };
  const hops = state.hops + 1;
  if (hops > 2) return { state: { ...state, hops }, action: 'none' };
  return { state: { ...state, hops }, action: hops === 1 ? 'auth' : 'claims' };
}
