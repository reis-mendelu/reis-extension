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
/**
 * Fails the build when a required VITE_* var is absent, instead of inlining
 * `undefined` and shipping an app that 401s at runtime.
 *
 * This is why "Odeslat zpětnou vazbu" never worked on iOS: with no
 * VITE_EXTENSION_SECRET, `submitSuggestion` hit its own guard and returned
 * before it ever fetched, so the only signal was the generic failure toast —
 * no request reached Supabase to log. A silent build-time hole became an
 * unexplained runtime failure. Loud here, or invisible on a device.
 */
function requireBuildEnv(names: readonly string[]) {
  return {
    name: 'reis-require-build-env',
    apply: 'build' as const,
    configResolved(cfg: { env: Record<string, unknown> }) {
      const missing = names.filter((n) => !cfg.env[n]);
      if (missing.length > 0) {
        throw new Error(
          `[reis] refusing to build: missing ${missing.join(', ')}.\n` +
            '       Run via `npm run build:capacitor` (wrapped in with-secrets.mjs)\n' +
            '       so Infisical injects it, or put it in the project-root .env.'
        );
      }
    },
  };
}

export default defineConfig({
  root: resolve(__dirname, 'capacitor'),
  publicDir: resolve(__dirname, 'public'),
  // envDir, NOT the default. Vite defaults envDir to `root`, which here is
  // `capacitor/` — a directory with no .env — so the project-root .env was
  // never read and every VITE_* var came out undefined.
  envDir: __dirname,
  plugins: [react(), tailwindcss(), requireBuildEnv(['VITE_EXTENSION_SECRET'])],
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
