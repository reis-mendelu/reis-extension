import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
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
    ],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'html'],
      // All four roots that `include` above runs tests for. Measuring only src/
      // meant the supabase edge functions, the build scripts and the Capacitor
      // entry were tested but never counted -- including the edge function whose
      // 2295-character payload bug is the reason supabase/ was added at all.
      // supabase/functions is deliberately absent: it is Deno code that this
      // node suite cannot execute (the `supabase/**` test glob matches zero
      // files), so including it only padded the denominator with 687
      // never-executable statements and flattered nothing. It is gated on its own
      // terms by `deno check` in deploy-supabase-functions.yml instead.
      include: ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,mjs}', 'capacitor/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.d.ts', '**/__tests__/**', '**/*.{test,spec}.*'],
      // A ratchet, in the same spirit as nuia-baseline.json: the global numbers
      // sit just under what the suite currently produces, so coverage can only
      // go up. Raise them when a run comfortably clears them.
      //
      // Coverage is only a signal where it tracks risk, so the boundaries that
      // can silently corrupt or strand a student's data get their own floors
      // rather than averaging out against the UI:
      //   - entrypoints  — the content-script/background boundary that holds the
      //                    auth cookies and every postMessage into the iframe
      //   - services/sync — per CLAUDE.md, the only authorised writer to
      //                    persistent state
      // Margins are ~3x the MEASURED run-to-run spread, not a guess and not a
      // single multiple of it.
      //
      // Most of the old drift was unit tests reaching the real jsDelivr CDN, so
      // an identical commit measured differently depending on what landed before
      // teardown; src/test/setup.ts now rejects unmocked fetches. What remains is
      // startApp.test.ts booting the real entrypoint and racing React's
      // scheduler, so how far the render gets varies. Observed across repeated
      // runs: statements 55.55-55.70, branches 79.56-79.74, functions
      // 63.41-63.61 -- a spread of up to 0.20pp. An earlier revision left the
      // functions margin at 0.21pp, i.e. one bad run from a spurious red.
      // A real regression moves whole points, so the looser floor still catches it.
      thresholds: {
        statements: 55.0,
        branches: 79.0,
        functions: 62.8,
        lines: 55.0,
        // Deliberately the whole subtree, iskam/ and main/ included -- the glob,
        // not the directory row. Scoping this to `src/entrypoints/*.ts` would
        // have quietly exempted the ISKAM iframe bootstrap, which is the half
        // that was at 0%.
        'src/entrypoints/**': {
          statements: 90,
          branches: 90,
          functions: 95,
          lines: 90,
        },
        // Measured 57.06 / 82.60 / 67.64, set just under. All three sit above
        // the global floor, which is the whole point of a per-area threshold --
        // an earlier revision set statements to 55 while the global floor was
        // 55.3, making this "stricter" gate looser than the repo-wide one.
        'src/services/sync/**': {
          statements: 56.8,
          branches: 82.3,
          functions: 67,
          lines: 56.8,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
