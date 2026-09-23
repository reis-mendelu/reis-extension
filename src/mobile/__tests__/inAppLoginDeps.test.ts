import { describe, it, expect, vi } from 'vitest';

const openWebView = vi.fn(async () => {});
vi.mock('@capgo/capacitor-inappbrowser', () => ({
  InAppBrowser: { openWebView },
}));

import { buildInAppLoginDeps } from '../inAppLoginDeps';

describe('buildInAppLoginDeps', () => {
  /**
   * The sign-out's own cookie clear cannot be relied on: it only reaches an
   * open browser dialog on Android and iOS < 17, and none is open by then. A
   * UISAuth left in the jar answers the next login with IS's dashboard, the
   * cookie poll reads it straight back, and the student is signed back in
   * without typing anything.
   *
   * The login is the one place a surviving cookie can do harm, so the jar is
   * emptied there, before the first navigation. It only opens when there is no
   * usable token, so nothing it drops was going to be used.
   */
  it('opens the login on an emptied cookie jar', async () => {
    const deps = await buildInAppLoginDeps();
    await deps.openLogin();
    expect(openWebView).toHaveBeenCalledWith(expect.objectContaining({ clearCookiesOnOpen: true }));
  });
});
