import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// Serves the real reIS iframe app at http://localhost:5199/main.html so
// Chrome MCP (claude-in-chrome) can drive the UI live. A CDP client cannot
// screenshot/script a *different extension's* chrome-extension:// frame, so in
// the `build:mcp` build the content script points its iframe here instead.
// See docs/superpowers/specs/2026-07-04-mcp-web-origin-iframe-design.md
export default defineConfig({
  root: resolve(__dirname),
  // Serve the extension's static assets (iskam_logo.png, outlook/teams icons,
  // fonts, emoji) so chrome.runtime.getURL('foo.png') → '/foo.png' resolves.
  publicDir: resolve(__dirname, '../public'),
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': resolve(__dirname, '../src') } },
  server: {
    port: 5199,
    strictPort: true,
    cors: true, // allow the is.mendelu.cz page to frame this origin
  },
});
