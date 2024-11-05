import { defineConfig } from '@playwright/test';


export default defineConfig({
  fullyParallel: true,
  globalSetup: 'tests/test-setup.js',
  testDir: 'tests',
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
  },
});