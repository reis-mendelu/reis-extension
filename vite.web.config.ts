import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { reisSnapshotPlugin } from './dev/snapshotPlugin';

// Where npm actually installed the dependencies. Identical to `<root>/node_modules`
// in a normal checkout; in a git worktree it points at the MAIN checkout instead.
const NODE_MODULES_ROOT = resolve(
  dirname(createRequire(import.meta.url).resolve('vite/package.json')),
  '..'
);

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
    // Honour PORT so the harness can assign a free one when something else is
    // already squatting 3000. strictPort stays on so a clash fails loudly
    // rather than silently drifting to another port the tests won't find.
    port: Number(process.env.PORT) || 3000,
    strictPort: true,
    fs: {
      // In a git worktree the local node_modules is nearly empty and packages
      // resolve to the MAIN checkout's node_modules, which sits outside Vite's
      // default allow list (the project root). Without this the
      // @fontsource/inter .woff2 files 403 and the app silently renders in the
      // system fallback face — invisible unless you diff the typography.
      allow: [resolve(__dirname), NODE_MODULES_ROOT],
    },
  },
});
