import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// reIS for Claude (mcp/): one self-contained Node ESM file for the .mcpb.
// Every dependency is inlined (ssr.noExternal) because a .mcpb runs without
// npm install.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      'pdf-lib': resolve(__dirname, 'mcp/optionalPeerStub.ts'),
      puppeteer: resolve(__dirname, 'mcp/optionalPeerStub.ts'),
      'tesseract.js': resolve(__dirname, 'mcp/optionalPeerStub.ts'),
    },
  },
  build: {
    ssr: resolve(__dirname, 'mcp/server.ts'),
    outDir: 'dist-mcp/server',
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    rollupOptions: {
      output: { format: 'es', entryFileNames: 'index.mjs', inlineDynamicImports: true },
    },
  },
  ssr: { noExternal: true, target: 'node' },
});
