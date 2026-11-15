const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NONCE = /^[a-z0-9]{1,32}$/i;

/**
 * The script injected into WebISKAM on every page load of the pay web view.
 *
 * It only ever does what the student could do with a finger: on
 * /InformaceOKlientovi it presses the claim's € button, which opens WebISKAM's
 * own "Uhradit" dialog. Paying is the dialog's button, and only the student
 * presses that. The script never sends a form and never presses that button
 * (src/test/guards/iskamNeverPays.test.ts reads this file).
 *
 * If the dialog did not pick up this claim's id, it is closed again, so the
 * student is never shown a dialog for a different claim.
 *
 * When the session in the web view has lapsed, WebISKAM lands elsewhere. Then
 * the script goes to the sign-in (AuthShibb, which is silent while the MENDELU
 * sign-in lives) and afterwards back to the claims page: two steps at most,
 * counted in the page's sessionStorage under a key unique to this opening,
 * and none at all if that storage is unavailable. Once the claims page has been
 * reached it never navigates again, so whatever page follows a payment stays.
 *
 * After paying, WebISKAM reloads the claims page without the claim and says
 * nothing (seen on the Pixel, 2026-11-15). So when the claims page comes back
 * without the claim this view opened, the script closes the view, and reIS
 * reports what the balance did (iskamStore.payClaim).
 */
export function buildPayScript(claimId: string, nonce: string): string {
  if (!GUID.test(claimId)) throw new Error('claim id is not a GUID');
  if (!NONCE.test(nonce)) throw new Error('bad nonce');
  return `(function () {
  var ID = ${JSON.stringify(claimId)};
  var KEY = ${JSON.stringify(`reisClaim_${nonce}`)};
  if (location.hostname !== 'webiskam.mendelu.cz') return;
  var st = null;
  try { st = JSON.parse(sessionStorage.getItem(KEY) || '{}'); } catch (e) { st = null; }
  function save() { try { sessionStorage.setItem(KEY, JSON.stringify(st)); return true; } catch (e) { return false; } }
  if (/^\\/InformaceOKlientovi\\/?$/i.test(location.pathname)) {
    if (st) { st.reached = 1; save(); }
    var btn = document.querySelector('.payfrommainaccount[data-id="' + ID + '"]');
    if (!btn) {
      // Opened earlier in this view, and now the signed-in claims page has no
      // such claim: it was paid. Hand the student back to reIS, which re-reads
      // the balance and says so.
      if (st && st.opened && document.getElementById('ZaplatitZKonta') &&
          window.mobileApp && window.mobileApp.close) {
        setTimeout(function () { window.mobileApp.close(); }, 600);
      }
      return;
    }
    if (st) { st.opened = 1; save(); }
    btn.click();
    setTimeout(function () {
      var f = document.getElementById('IDPolozky');
      if (!f || f.value !== ID) {
        if (window.jQuery) window.jQuery('#ZaplatitZKonta').modal('hide');
      }
    }, 500);
    return;
  }
  if (!st || st.reached) return;
  if (/^\\/(Prihlaseni|Shibboleth\\.sso)/i.test(location.pathname)) return;
  st.hops = (st.hops || 0) + 1;
  if (st.hops > 2 || !save()) return;
  location.href = st.hops === 1 ? '/Prihlaseni/AuthShibb' : '/InformaceOKlientovi';
})();`;
}
