import { describe, it, expect, vi, beforeEach } from 'vitest';

const order: string[] = [];
const platform = vi.hoisted(() => ({ os: 'android' }));

vi.mock('@capgo/capacitor-inappbrowser', () => ({
  InAppBrowser: {
    openWebView: vi.fn(async () => {
      order.push('openWebView');
    }),
  },
}));
vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    hide: vi.fn(async () => {
      order.push('hide');
    }),
  },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => platform.os },
}));
vi.mock('../../platform/tokenStore', () => ({
  loadStoredToken: vi.fn(),
  saveStoredToken: vi.fn(),
}));

import { buildInAppLoginDeps } from '../inAppLoginDeps';

beforeEach(() => {
  order.length = 0;
});

/**
 * Android before 12 holds EVERY window of the app hidden until the activity's
 * own window draws, and the compat splash (launchAutoHide: false) blocks that
 * draw until SplashScreen.hide(). boot() hides it only after login completes —
 * so on Android 10/11 the login dialog was never shown and the student sat on
 * the splash forever. Reproduced on an API 30 emulator: the dialog window was
 * READY_TO_SHOW behind a DRAW_PENDING activity until hide() was called.
 */
describe('buildInAppLoginDeps().openLogin', () => {
  it('hides the splash on Android once the login is presented, not before', async () => {
    platform.os = 'android';
    const deps = await buildInAppLoginDeps();
    await deps.openLogin();
    expect(order).toEqual(['openWebView', 'hide']);
  });

  it('leaves the splash to boot() on iOS, where the modal draws above it', async () => {
    platform.os = 'ios';
    const deps = await buildInAppLoginDeps();
    await deps.openLogin();
    expect(order).toEqual(['openWebView']);
  });

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
    const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
    const deps = await buildInAppLoginDeps();
    await deps.openLogin();
    expect(InAppBrowser.openWebView).toHaveBeenCalledWith(
      expect.objectContaining({ clearCookiesOnOpen: true })
    );
  });
});
