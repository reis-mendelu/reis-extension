import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Vite turns `import x from 'foo?url'` into an emitted-asset URL at build time;
// under vitest that transform does not run and the import fails to resolve. The
// only thing any test cares about is that a path-like string arrives, so stub it
// with the request itself. Without this, importing a module that resolves an
// asset URL (pdfWorkerSource, and PdfViewer through it) is untestable.
const assetUrlStub = {
  name: 'reis:stub-asset-url-imports',
  enforce: 'pre' as const,
  resolveId(id: string) {
    return id.endsWith('?url') ? '\0asset-url:' + id : null;
  },
  load(id: string) {
    if (!id.startsWith('\0asset-url:')) return null;
    const request = id.slice('\0asset-url:'.length).replace(/\?url$/, '');
    return `export default ${JSON.stringify(request.split('/').pop())};`;
  },
};

export default defineConfig({
  plugins: [assetUrlStub, react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    // No unit test may touch the public internet. happy-dom treats a real
    // `window.open` / link click as a navigation and FETCHES the page —
    // `src/mobile/__tests__/openExternal.test.ts` was pulling is.mendelu.cz and
    // esn.mendelu.cz down over the wire, googletagmanager and all. That passed
    // on a laptop and timed out at 5s on a CI runner, which is how PR #361
    // failed Unit tests while green locally. Disabling navigation is the fix;
    // raising testTimeout would only have made the flake slower.
    //
    // `disableFallbackToSetURL` is left at its default (false), so a blocked
    // navigation still updates the URL — any assertion on location keeps working.
    environmentOptions: {
      happyDOM: {
        settings: {
          navigation: {
            disableMainFrameNavigation: true,
            disableChildFrameNavigation: true,
            disableChildPageNavigation: true,
          },
        },
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    // supabase/ is included for edge-function logic that is pure TypeScript and
    // imports no Deno globals. `tsc` covers only src/, so without this an edge
    // function's rules — like the Discord length budget — could only be checked
    // by reading them, which is how a 2295-character payload got past a comment
    // asserting it fitted in 2000.
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'scripts/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'supabase/**/*.{test,spec}.{js,ts}',
      // main.capacitor.tsx lives outside src/ (it's the Capacitor entry point,
      // built by a separate vite config) but still needs coverage for the
      // demo-mode boot branch.
      'capacitor/**/*.{test,spec}.{js,ts,jsx,tsx}',
      // dev/ is the localhost:3000 harness, not shipped code — but the store
      // handle it publishes is what every automated UI check reads through, so
      // the contract that it publishes the REAL store needs a test.
      'dev/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
