// The isometric campus map on its own page, for showing it to someone who has no reIS: no login,
// no IS Mendelu, no society data. Built by `npm run build:iso-demo`; nothing here reaches the apps.
import '../chromeShim';
// First after the shim, as in main.web.tsx: puts the page in demo mode before the store can
// reach the network (the daily install count, the feature counters).
import '../earlyDemoMode';
import '../installWebPlatform';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-600.css';
import '@/index.css';
import { IsoMapView } from '@/components/CampusMap/iso/IsoMapView';
import { useAppStore } from '@/store/useAppStore';

useAppStore.getState().setIsoMapOpen(true);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="relative h-dvh w-full overflow-hidden">
      <IsoMapView closable={false} />
    </div>
  </StrictMode>
);
