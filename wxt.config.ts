import { defineConfig } from 'wxt';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  webExt: {
    disabled: process.env.WXT_RUNNER_DISABLED === 'true',
  },
  manifest: {
    name: 'reIS',
    version: '4.0.1',
    description: 'Modernized reIS extension for IS Mendelu',
    icons: {
      16: 'mendelu_logo_16.png',
      48: 'mendelu_logo_48.png',
      128: 'mendelu_logo_128.png',
    },
    permissions: ['storage', 'unlimitedStorage'],
    host_permissions: ['https://is.mendelu.cz/*'],
    action: {
      default_popup: 'main.html',
    },
    web_accessible_resources: [
      {
        resources: [
          'main.html',
          'assets/*',
          'mendelu_logo_16.png',
          'mendelu_logo_48.png',
          'mendelu_logo_128.png',
          'fonts/*',
        ],
        matches: ['https://is.mendelu.cz/*'],
      },
    ],
  },
  vite: () => ({
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }),
});
