// MUST be first: installs the Capacitor host before anything reads it.
import './installCapacitorPlatform';

import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
import { InAppBrowser } from '@capgo/capacitor-inappbrowser';
import { getPlatform } from '@/platform';
import { TOKEN_KEY } from '@/platform/tokenStore';
import { ensureSession } from '@/mobile/ensureSession';
import { handleBackPress } from '@/mobile/backButton';
import { useAppStore } from '@/store/useAppStore';

const IS_LOGIN_URL = 'https://is.mendelu.cz/system/login.pl?lang=cz';
const IS_COOKIE_URL = 'https://is.mendelu.cz/';

/**
 * Android's hardware back unwinds the sheet stack before exiting. Registered
 * before boot so it works even while the login WebView is up.
 */
void CapApp.addListener('backButton', () => {
  const s = useAppStore.getState();
  if (handleBackPress({ sheetCount: s.mobileSheets.length, popSheet: s.popSheet }) === 'exit') {
    void CapApp.exitApp();
  }
});

async function boot(): Promise<void> {
  const storage = getPlatform().storage;

  await ensureSession({
    getStored: () => storage.get(TOKEN_KEY),
    save: (token) => storage.set(TOKEN_KEY, token),
    openLogin: async () => {
      await InAppBrowser.openWebView({
        url: IS_LOGIN_URL,
        title: 'Přihlášení do UIS',
        isPresentAfterPageLoad: true,
      });
    },
    onPageLoaded: (cb) => InAppBrowser.addListener('browserPageLoaded', () => cb()),
    // Backing out of the login must reject rather than hang the splash screen.
    onDismissed: (cb) => InAppBrowser.addListener('closeEvent', () => cb()),
    readCookies: () =>
      InAppBrowser.getCookies({ url: IS_COOKIE_URL, includeHttpOnly: true }) as Promise<
        Record<string, string>
      >,
    closeWebView: async () => {
      await InAppBrowser.close();
    },
  });

  // Dynamic import on purpose: this module renders the React root on
  // evaluation, so a static import would boot the app BEFORE a session exists
  // and every sync request would fail its auth check.
  await import('@/entrypoints/main/main');
  await SplashScreen.hide();

  // In the extension the CONTENT SCRIPT drives this and posts results into the
  // iframe. Capacitor has neither, so the app drives its own sync; sendToIframe
  // loops the results back to this same window, where useAppLogic's existing
  // handler consumes them unchanged.
  // startSyncService fires an immediate syncAllData() and then sets the
  // SYNC_INTERVAL timer — no separate first call needed.
  const { syncAllData, startSyncService } = await import('@/injector/syncService');
  startSyncService();

  // IS's session is a sliding inactivity window, so a returning student is
  // usually still authenticated — refresh on resume rather than only at boot.
  void CapApp.addListener('resume', () => {
    void syncAllData().catch(() => {});
  });
}

void boot().catch(async (e) => {
  // Never leave the student on a splash screen with no explanation.
  await SplashScreen.hide();
  document.getElementById('root')!.textContent = `reIS failed to start: ${String(e)}`;
});
