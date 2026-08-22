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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell>
      <App />
    </AppShell>
  </StrictMode>
);
