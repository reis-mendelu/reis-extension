import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-ext-700.css';
import '@/index.css';
import '@/utils/devFeatures'; // Register window.toggleDevFeatures
import App from '@/App.tsx';
import { AppShell } from '@/components/AppShell';
import { installErrorReporter } from '@/services/errorReporter/reporter';
import { installExternalLinkHandler } from '@/mobile/openExternal';
import { initTelemetry } from '@/services/errorReporter/telemetry';
import { useAppStore } from '@/store/useAppStore';

// Both flags, not just the toggle. These reporters are installed at module
// load so they catch startup failures, but the persisted opt-out is read from
// IndexedDB asynchronously — so until it lands, `errorReportingEnabled` is only
// an optimistic default. Gating on hydration too is what makes the store
// listing's "you can turn this off" claim actually true.
const reportingAllowed = () => {
  const s = useAppStore.getState();
  return s.errorReportingHydrated && s.errorReportingEnabled;
};

installErrorReporter(reportingAllowed);
initTelemetry(reportingAllowed);

// At module load, before the first render, because a `target="_blank"` anchor
// does NOTHING on its own inside the Capacitor WebView: there is no tab to open
// and no default window.open to fall back on. The handler had been written and
// tested from six angles and never once installed, which is why "clicking on an
// item in vyveska doesn't open it (also the external click there does nothing)"
// was true of every external link in the app — the vývěska posts, its
// show-all button, and the notification links alike.
//
// Not in an effect: MobileBulletinOverlay portals to document.body, outside the
// React tree, and its links are among the first things a student can tap.
installExternalLinkHandler();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell>
      <App />
    </AppShell>
  </StrictMode>
);
