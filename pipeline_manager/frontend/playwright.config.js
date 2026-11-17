import { defineConfig } from '@playwright/test';

const isCI = Boolean(process.env.CI || process.env.CI_JOB_NAME);

export default defineConfig({
  fullyParallel: true,
  testDir: 'tests',
  reporter: [
              ['html',  { open: 'never' }],
              ['json', {  outputFile: 'test-results.json' }]
            ],
  retries: 3,
  outputDir: 'editor-test-traces',

  webServer: {
      command: 'npx --no-install --yes serve --cors -p 7001 ../../examples',
  },

  use: {
      trace: isCI ? 'on' : 'retain-on-failure',
      video: isCI ? 'on' : 'retain-on-failure',
      viewport: { width: 1920, height: 1080 },
  },
});
