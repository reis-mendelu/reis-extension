import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './university-monitor/tests',
  globalSetup: require.resolve('./university-monitor/tests/global-setup'),
  use: {
    // In the container, we want to see traces if it fails
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    storageState: 'storageState.json',
  },
  reporter: [['html', { open: 'never' }]],
});