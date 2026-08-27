import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cz.reis.app',
  appName: 'reIS',
  webDir: 'dist-capacitor',
  // The campus map pulls basemap tiles straight from tile.openstreetmap.org
  // (src/components/CampusMap/mapLayers.ts). From a native shell those are
  // application requests, and OSM's tile usage policy blocks traffic it cannot
  // identify — a default WKWebView/Android WebView UA reads as a browser
  // impersonating one. Append a stable name and a contact URL so the map does
  // not one day go blank for every mobile student. Appended, not overridden:
  // the platform half of the UA still has to be truthful.
  appendUserAgent: 'reIS/5 (+https://github.com/reis-mendelu/reis-extension)',
  plugins: {
    // The app must not become visible until we know whether a login WebView is
    // about to be presented — otherwise the student sees an empty reIS frame
    // flash before the IS login page. main.capacitor.ts hides it explicitly.
    SplashScreen: { launchAutoHide: false },
  },
};

export default config;
