import { defineConfig } from 'vite';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Where npm actually installed the dependencies. Identical to `<root>/node_modules`
// in a normal checkout; in a git worktree it points at the MAIN checkout instead.
const NODE_MODULES_ROOT = resolve(
  dirname(createRequire(import.meta.url).resolve('vite/package.json')),
  '..'
);

// Capacitor build of reIS. Same React app as the extension and the dev webapp —
// the only difference is which host is installed at the entry point and, as a
// consequence, which transport fetchWithAuth picks.
export default defineConfig({
  root: resolve(__dirname, 'capacitor'),
  publicDir: resolve(__dirname, 'public'),
  plugins: [react(), tailwindcss()],
  // The app has no extension manifest to read a version out of, so telemetry
  // and the feedback form reported 0.0.0 / a hand-edited constant for every
  // report a phone ever sent. Injected here instead.
  define: {
    __REIS_APP_VERSION__: JSON.stringify(createRequire(import.meta.url)('./package.json').version),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist-capacitor'),
    emptyOutDir: true,
  },
  server: {
    fs: {
      // See vite.web.config.ts — worktree node_modules resolves to the main
      // checkout, which is outside Vite's default allow list.
      allow: [resolve(__dirname), NODE_MODULES_ROOT],
    },
  },
});
