import { defineConfig } from 'vite';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Standalone webapp dev harness for reIS — runs the React app as a plain
// localhost page (no extension, no iframe), ingesting the scraped snapshot
// from public/dev-real-data.json via the app's normal REIS_SYNC_UPDATE path.
export default defineConfig({
  root: resolve(__dirname, 'dev'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
