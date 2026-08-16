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
