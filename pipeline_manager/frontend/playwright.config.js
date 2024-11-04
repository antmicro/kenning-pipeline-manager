import { defineConfig } from '@playwright/test';

export default defineConfig({
    globalSetup: 'tests/test-setup.js',
});