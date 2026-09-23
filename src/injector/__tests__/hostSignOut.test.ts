import { describe, it, expect, vi, beforeEach } from 'vitest';

const clearAll = vi.fn(async () => {});
const clearUserParamsCache = vi.fn();

vi.mock('../../services/storage/IndexedDBService', () => ({
  IndexedDBService: { clearAll: () => clearAll() },
}));
vi.mock('../../utils/userParams', () => ({
  clearUserParamsCache: () => clearUserParamsCache(),
}));

const { signOutFromHostPage } = await import('../hostSignOut');

/** IS's own logout form, as it sits in the page chrome of every /auth/ page. */
function seedIsLogoutForm(): { form: HTMLFormElement; clicks: string[] } {
  const clicks: string[] = [];
  const form = document.createElement('form');
  form.action = '/auth/system/logout.pl';
  const input = document.createElement('input');
  input.type = 'submit';
  input.name = 'odhlaseni';
  input.addEventListener('click', () => clicks.push('odhlaseni'));
  form.appendChild(input);
  document.body.appendChild(form);
  return { form, clicks };
}

function authenticated(path = '/auth/student/studium.pl') {
  // happy-dom allows the assignment; the submit itself is a no-op there.
  window.history.replaceState({}, '', path);
}

describe('signOutFromHostPage', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    clearAll.mockClear().mockResolvedValue(undefined);
    clearUserParamsCache.mockClear();
    authenticated();
  });

  /**
   * THE HALF SIGN-OUT COULD NEVER REACH.
   *
   * IndexedDB is origin-scoped, and this extension writes the SAME database
   * from two origins: the iframe app (chrome-extension://…) and the content
   * script, which runs on the host page and therefore stores under
   * https://is.mendelu.cz. `proxyClient.logout()` runs in the iframe, so its
   * `clearAll()` only ever emptied the iframe's copy — the content script's
   * `reis_user_params`, its cached classmates and its past-semester snapshots
   * stayed on the host origin, where no amount of signing out could touch
   * them. Uninstalling the extension does not clear them either: that storage
   * belongs to is.mendelu.cz, not to the extension.
   *
   * The content script is the only context that can empty it, which is why
   * the wipe has to happen here, on the way out.
   */
  it('empties the host-origin database before it submits the logout', async () => {
    const order: string[] = [];
    clearAll.mockImplementation(async () => void order.push('clear'));
    const form = seedIsLogoutForm().form;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      order.push('submit');
    });

    await signOutFromHostPage();
    expect(order[0]).toBe('clear');
    expect(clearUserParamsCache).toHaveBeenCalled();
  });

  // IS's own form and its own button: the submit is theirs, not ours.
  it('drives IS’s existing logout form', async () => {
    const { clicks } = seedIsLogoutForm();
    const result = await signOutFromHostPage();
    expect(clicks).toEqual(['odhlaseni']);
    expect(result).toEqual({ success: true });
  });

  /**
   * A stubborn IndexedDB must not strand the student signed IN. Unlike the
   * mobile path — where the credential is a token this device owns, so a
   * failed wipe means the sign-out itself failed — what holds this session
   * open is IS's own cookie, which only IS can clear. Refusing to submit
   * would leave them signed in with no way out of it.
   */
  it('still signs out when the wipe fails', async () => {
    clearAll.mockRejectedValue(new Error('idb blocked'));
    const { clicks } = seedIsLogoutForm();

    const result = await signOutFromHostPage();
    expect(result).toEqual({ success: true });
    expect(clicks).toEqual(['odhlaseni']);
  });

  // Nothing to sign out of, and so nothing to delete: this is the pre-login
  // page, and a wipe here would be data loss with no sign-out to justify it.
  it('deletes nothing when the page is not an authenticated session', async () => {
    window.history.replaceState({}, '', '/system/login.pl');
    const result = await signOutFromHostPage();
    expect(result).toEqual({ success: false, reason: 'not_authenticated' });
    expect(clearAll).not.toHaveBeenCalled();
  });

  // No form in the chrome (IS redesign, a stripped page): post one ourselves.
  it('posts its own form when IS’s is not in the page', async () => {
    authenticated();
    const submitted: string[] = [];
    // happy-dom's form.submit() is a no-op, so assert on the DOM we built.
    await signOutFromHostPage();
    const form = document.querySelector('form[action="/auth/system/logout.pl"]');
    expect(form).not.toBeNull();
    expect(form?.querySelector('input[name="odhlaseni"]')).not.toBeNull();
    expect(submitted).toEqual([]);
  });
});
