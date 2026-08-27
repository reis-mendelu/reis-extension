import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom',
    // happy-dom fetches subresources with its OWN internal Fetch, not the global
    // one, so the unmocked-fetch guard in src/test/setup.ts never sees them. The
    // IS HTML fixtures carry <link rel=stylesheet> and <script src> tags, and a
    // full run made ~70 real requests to http://localhost:3000/css/... -- which
    // is the port `npm run dev:web` serves on, so a developer with the dev server
    // running had those ANSWERED, and some attempts reached is.mendelu.cz itself.
    // It also made the run nondeterministic: the count varied 71-77 on an
    // identical commit, which is precisely what a coverage ratchet cannot afford.
    environmentOptions: {
      happyDOM: {
        settings: {
          disableCSSFileLoading: true,
          disableJavaScriptFileLoading: true,
          disableIframePageLoading: true,
        },
      },
    },
    setupFiles: ['./src/test/setup.ts'],
    // NOT set: restoreMocks / unstubGlobals / clearMocks.
    //
    // They are the structural answer to the state-leak bugs that made this suite
    // order-dependent, and they were tried: `restoreMocks` alone fails 46 tests,
    // with `unstubGlobals` 71. Many suites set mock implementations at module
    // scope or stub a global once per file, and both options undo that between
    // tests. Turning them on means repairing ~70 suites in the same change,
    // which is its own piece of work — flipping the switch and leaving the suite
    // red would be worse than the leak.
    //
    // The leaks themselves are fixed per-file, and the `test-shuffled` CI job
    // (random seed each run) is what stops new ones surviving unnoticed.
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
      // runs: a spread of up to ~0.1pp. These floors were also RE-BANKED after
      // the tests added since they were first set -- left at their old values
      // they had drifted to 2-8pp of slack, enough to delete whole test files
      // without tripping anything. Verified: removing a single test file from
      // entrypoints/ now fails the run.
      //
      // The happy-dom subresource loading that used to make the numbers move
      // between identical runs is disabled in environmentOptions above.
      thresholds: {
        statements: 56.3,
        branches: 79.1,
        functions: 63.3,
        lines: 56.3,
        // Deliberately the whole subtree, iskam/ and main/ included -- the glob,
        // not the directory row. Scoping this to `src/entrypoints/*.ts` would
        // have quietly exempted the ISKAM iframe bootstrap, which is the half
        // that was at 0%.
        'src/entrypoints/**': {
          statements: 98,
          branches: 97,
          functions: 100,
          lines: 98,
        },
        // Measured 63.56 / 87.80 / 70.59, set just under. All three sit above
        // the global floor, which is the whole point of a per-area threshold --
        // an earlier revision set statements to 55 while the global floor was
        // 55.3, making this "stricter" gate looser than the repo-wide one.
        'src/services/sync/**': {
          statements: 62.9,
          branches: 87,
          functions: 70,
          lines: 62.9,
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
