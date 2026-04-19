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
    version: '4.9.4',
    description: 'Modernizovaný reIS rozšířený pro IS Mendelu',
    icons: {
      16: 'reIS_logo_16.png',
      48: 'reIS_logo_48.png',
      128: 'reIS_logo_128.png',
    },
    permissions: ['storage', 'unlimitedStorage'],
    host_permissions: [
      'https://is.mendelu.cz/*',
      'https://raw.githubusercontent.com/reis-mendelu/reis-data/*',
      'https://cdn.jsdelivr.net/gh/reis-mendelu/reis-data@main/*',
      'https://skm.mendelu.cz/*',
      'https://mendelu.cz/*',
      'https://darksoothingshadow-reis-syllabus-similarity.hf.space/*',
      'https://zvbpgkmnrqyprtkyxkwn.supabase.co/*',
      'https://hei.api.uni-foundation.eu/*',
    ],
    action: {
      default_popup: 'main.html',
    },
    browser_specific_settings: {
      gecko: {
        id: 'reis-extension@mendelu.cz',
        strict_min_version: '140.0',
        // @ts-expect-error Firefox AMO requires data_collection_permissions
        data_collection_permissions: {
          required: ['none'],
          optional: [],
        },
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: [
          'main.html',
          'assets/*',
          'reIS_logo_16.png',
          'reIS_logo_48.png',
          'reIS_logo_128.png',
          'reIS_logo.svg',
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
