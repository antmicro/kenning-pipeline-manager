import { test, expect } from '@playwright/test';
import { getUrl, enableNavigationBar, addNode, dragAndDrop } from './config.js';

async function enableEditingNodes(page: Page) {
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
}

async function createNewNodeType(page: Page) {
    // Open node configuration menu
    const logo = await page.locator('.logo');
    await logo.hover();
    const addNodeButton = await logo.locator('#create-new-node-type-button');
    await addNodeButton.click();

    // Create node
    const nodeMenu = await page.locator('#container').locator('.create-menu');
    const createButton = await nodeMenu.getByText('Create');
    await createButton.click();
}

test('enable editing', async ({ page }) => {
    await enableEditingNodes(page);
});

test('create new node type', async ({ page }) => {
    await enableEditingNodes(page);
    await createNewNodeType(page);
    await addNode(page, 'Default category', 'Custom Node', 750, 80);
});
