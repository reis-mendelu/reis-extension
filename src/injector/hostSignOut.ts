import { IndexedDBService } from '../services/storage/IndexedDBService';
import { clearUserParamsCache } from '../utils/userParams';
import { logError } from '../utils/reportError';

export type HostSignOutResult = { success: true } | { success: false; reason: 'not_authenticated' };

/**
 * Signing out of IS from the host page.
 *
 * Two things have to happen here, and only this context can do either of them.
 *
 * **The logout itself is DOM-bound.** IS's logout URL is never constructed by
 * reIS — it is read off the page chrome, where IS puts its own form, and that
 * form is submitted with IS's own button. The iframe app cannot reach it
 * (different origin, no host page), so it asks for this through a
 * `REIS_ACTION`.
 *
 * **The host-origin data has to be deleted here too.** IndexedDB is
 * origin-scoped and reIS writes `reis_db` from two origins: the iframe app
 * under `chrome-extension://…`, and this content script, which runs on the
 * host page and therefore stores under `https://is.mendelu.cz`. The content
 * script's copy holds `reis_user_params`, cached classmates and past-semester
 * snapshots. `proxyClient.logout()` runs in the iframe, so its `clearAll()`
 * only ever emptied the iframe's half — and the host origin is not extension
 * storage, so uninstalling the extension does not clear it either. It
 * survived every sign-out reIS has ever performed.
 *
 * The order is wipe-then-submit because the submit navigates and this context
 * stops existing. A failed wipe does NOT cancel the sign-out: what holds this
 * session open is IS's own cookie, which only IS can clear, so refusing to
 * submit would leave the student signed in with no way out. That is the
 * opposite of `mobile/signOut.ts`, where the credential is a token this
 * device owns and a failed wipe therefore means the sign-out failed.
 */
export async function signOutFromHostPage(): Promise<HostSignOutResult> {
  if (!window.location.pathname.includes('/auth/')) {
    console.warn('Not in an authenticated session. No need to log out.');
    return { success: false, reason: 'not_authenticated' };
  }

  try {
    clearUserParamsCache();
    await IndexedDBService.clearAll();
  } catch (e) {
    logError('HostSignOut.clearAll', e);
  }

  const existingForm = document.querySelector(
    'form[action="/auth/system/logout.pl"]'
  ) as HTMLFormElement;
  if (existingForm) {
    const logoutButton = existingForm.querySelector('input[name="odhlaseni"]') as HTMLInputElement;
    if (logoutButton) {
      logoutButton.click();
    } else {
      existingForm.submit();
    }
    return { success: true };
  }

  const dynamicForm = document.createElement('form');
  dynamicForm.method = 'POST';
  dynamicForm.action = '/auth/system/logout.pl';
  dynamicForm.style.display = 'none';

  const payloadInput = document.createElement('input');
  payloadInput.type = 'hidden';
  payloadInput.name = 'odhlaseni';
  payloadInput.value = 'Log out';

  dynamicForm.appendChild(payloadInput);
  document.body.appendChild(dynamicForm);
  dynamicForm.submit();
  return { success: true };
}
