import { defineConfig } from '@playwright/test';


export default defineConfig({
  fullyParallel: true,
  testDir: 'tests',
  reporter: [
              ['html',  { open: 'never' }],
              ['json', {  outputFile: 'test-results.json' }]
            ],
  retries: 3,

  webServer: {
      command: 'npx --no-install --yes serve --cors -p 7001 ../../examples',
  },

  use: {
      trace: 'on',
      video: 'on',
      // We disable web security to allow for embedding the KPM inside an
      // iframe for the API testing purposes.
      bypassCSP: true,
      launchOptions: {
          args: ['--disable-web-security'],
      },
      viewport: { width: 1920, height: 1080 },
  },
});
