import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { reisSnapshotPlugin } from './dev/snapshotPlugin';

// Standalone webapp dev harness for reIS — runs the React app as a plain
// localhost page (no extension, no iframe), ingesting the scraped snapshot
// from public/dev-real-data.json via the app's normal REIS_SYNC_UPDATE path.
export default defineConfig({
  root: resolve(__dirname, 'dev'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss(), reisSnapshotPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  define: {
    // Default the dev-only "reIS" test society ON for the webapp harness so the
    // society/organizer UI is available without a Supabase login on every reload
    // (see src/utils/mock/devSociety.ts). Only affects `npm run dev:web`; the
    // shipped extension builds via wxt.config.ts and never sees this. Override
    // with `VITE_DEV_SOCIETY= npm run dev:web` to test the real login flow.
    'import.meta.env.VITE_DEV_SOCIETY': JSON.stringify(process.env.VITE_DEV_SOCIETY ?? 'reis'),
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
