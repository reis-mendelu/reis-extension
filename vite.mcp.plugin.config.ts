import { defineConfig, mergeConfig } from 'vite';
import { resolve } from 'node:path';
import base from './vite.mcp.config';

// reIS for Claude as a Claude Code plugin (npm run mcp:plugin). Claude Code
// reads PDF and Office files itself, so the server hands files over whole
// (mcp/documentHandover.ts) and officeparser stays out: the directory stops
// validating any plugin file over 5 MiB. Unminified, so the scan can read it.
export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: [
        { find: './documentText', replacement: resolve(__dirname, 'mcp/documentHandover.ts') },
      ],
    },
    build: { outDir: 'dist-plugin/reis/server' },
  })
);
