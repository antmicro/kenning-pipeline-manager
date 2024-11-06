import { defineConfig } from '@playwright/test';


export default defineConfig({
  fullyParallel: true,
  testDir: 'tests',
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
  },
});