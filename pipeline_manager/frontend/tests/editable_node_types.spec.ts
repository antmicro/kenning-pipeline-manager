import { test, expect } from '@playwright/test';
import { getUrl } from './config.js';

test('enable editing', async ({ page }) => {
    await page.goto(getUrl());

    // Assert that node types cannot be added
    const logo = await page.locator('.logo');
    await logo.hover();
    let addNodeButton = await logo.locator('#create-new-node-type-button');
    expect(addNodeButton).toBeHidden();

    // Enable modifying node types
    const settings = await page.locator('.settings-panel');
    expect(settings).toBeVisible();

    const checkbox = await settings.locator('.baklava-checkbox').nth(1).locator('.__checkmark-container');
    expect(checkbox).toBeVisible();
    await checkbox.click();

    // Assert that node types can be added
    await logo.hover();
    addNodeButton = await logo.locator('#create-new-node-type-button');
    expect(addNodeButton).toBeVisible();
});
