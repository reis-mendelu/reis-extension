import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/inter/latin-ext-400.css'
import '@fontsource/inter/latin-ext-500.css'
import '@fontsource/inter/latin-ext-600.css'
import '@fontsource/inter/latin-ext-700.css'
import '@/index.css'
import '@/utils/devFeatures' // Register window.toggleDevFeatures
import App from '@/App.tsx'
import { AppShell } from '@/components/AppShell'
import { installErrorReporter } from '@/services/errorReporter/reporter'
import { initTelemetry } from '@/services/errorReporter/telemetry'
import { GoogleDevPanel } from '@/components/GoogleDevPanel'
import { useAppStore } from '@/store/useAppStore'

installErrorReporter(() => useAppStore.getState().errorReportingEnabled)
initTelemetry(() => useAppStore.getState().errorReportingEnabled)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell>
      <App />
      <GoogleDevPanel />
    </AppShell>
  </StrictMode>,
)
