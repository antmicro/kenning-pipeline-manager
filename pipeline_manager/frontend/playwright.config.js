import { defineConfig } from '@playwright/test';


export default defineConfig({
  fullyParallel: true,
  testDir: 'tests',
  reporter: 'html',
  retries: 3,

  webServer: {
      command: 'npx --no-install --yes serve --cors -p 7001 ../../examples',
  },

  use: {
    trace: 'on',
    video: 'on',
  },
});
