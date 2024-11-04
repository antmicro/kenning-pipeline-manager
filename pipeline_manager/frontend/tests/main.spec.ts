import { test, expect } from '@playwright/test';

const URL = "http://localhost:8080"

test('has title', async ({ page }) => {
  await page.goto(URL);
  expect(await page.title()).toBe('Pipeline Manager');
});