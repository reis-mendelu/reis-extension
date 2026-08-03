import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cz.reis.app',
  appName: 'reIS',
  webDir: 'dist-capacitor',
  plugins: {
    // The app must not become visible until we know whether a login WebView is
    // about to be presented — otherwise the student sees an empty reIS frame
    // flash before the IS login page. main.capacitor.ts hides it explicitly.
    SplashScreen: { launchAutoHide: false },
  },
};

export default config;
