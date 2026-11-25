import { defineConfig } from 'vite';
import { resolve } from 'path';
import { createRequire } from 'module';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { pdfjsLegacyAliases } from './scripts/pdfjsLegacyAlias';

// The isometric map alone, as a static page (`npm run build:iso-demo`). Like the web preview build it
// reads no .env: envDir is the committed-empty directory, so no VITE_* secret can be inlined.
// publicDir is off for the same reason: the repo's public/ holds the real-data snapshot.
export default defineConfig({
  root: resolve(__dirname, 'dev/isoDemo'),
  publicDir: false,
  envDir: resolve(__dirname, 'scripts/web-build-envdir'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [{ find: '@', replacement: resolve(__dirname, 'src') }, ...pdfjsLegacyAliases],
  },
  define: {
    'import.meta.env.VITE_DEV_SOCIETY': JSON.stringify(''),
    __REIS_APP_VERSION__: JSON.stringify(createRequire(import.meta.url)('./package.json').version),
  },
  build: { outDir: resolve(__dirname, 'dist-iso-demo'), emptyOutDir: true, sourcemap: false },
});
