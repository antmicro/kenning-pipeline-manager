import { defineConfig } from '@playwright/test';


export default defineConfig({
  fullyParallel: true,
  testDir: 'tests',
  reporter: 'html',
  retries: 3,

  use: {
    trace: 'on-first-retry',
  },
});