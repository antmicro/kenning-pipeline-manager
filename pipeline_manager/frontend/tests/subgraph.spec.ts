import { test, expect, Page, Locator } from '@playwright/test';
import { getUrl } from './config.js';

async function enterSubgraph(page: Page, nodeWithSubgraph: Locator) {
    await nodeWithSubgraph.locator('.__title').click({ button: 'right' });
    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Edit Subgraph');
    await contextMenuOption.click();
}

test('test entering subgraph', async ({ page }) => {
    await page.goto(getUrl('subgraph'));

    // There are four nodes initially.
    let nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(4);

    const nodeContainingSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await enterSubgraph(page, nodeContainingSubgraph);

    // A subgraph contains two nodes.
    nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(2);
});

test('test coming back from subgraph', async ({ page }) => {
    await page.goto(getUrl('subgraph'));

    // There are four nodes initially.
    const nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(4);

    const nodeContainingSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await enterSubgraph(page, nodeContainingSubgraph);
    // A subgraph contains two nodes.
    expect(await nodes.count()).toBe(2);

    // Leave a subgraph.
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();
    expect(await nodes.count()).toBe(4);
});
