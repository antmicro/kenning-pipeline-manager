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
    expect(await nodes.count()).toBe(2);
});

test('test coming back from subgraph', async ({ page }) => {
    await page.goto(getUrl('subgraph'));

    // Initially, there are four nodes.
    const nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(4);

    const nodeContainingSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await enterSubgraph(page, nodeContainingSubgraph);
    // A subgraph contains two nodes.
    expect(await nodes.count()).toBe(2);

    // Leave the subgraph.
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();
    expect(await nodes.count()).toBe(4);
});

async function dragAndDrop(page: Page, locator: Locator, to: { x: number; y: number }) {
    await locator.hover();
    await page.mouse.down();
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();
}

test('test preserving changes to subgraph', async ({ page }) => {
    await page.goto(getUrl('subgraph'));

    const nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(4);

    const nodeContainingSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await enterSubgraph(page, nodeContainingSubgraph);
    expect(await nodes.count()).toBe(2);

    // Add a new node: open the node browser, expand a category, and drag & drop a node.
    const showNodesButton = page.getByText('Show node browser').locator('../..');
    await showNodesButton.click();

    const firstCategoryLabel = page.getByText('First Category');
    await firstCategoryLabel.click();

    const nodeFromBrowser = page.getByText('Test node #').first();
    await dragAndDrop(page, nodeFromBrowser, { x: 400, y: 200 });
    expect(await nodes.count()).toBe(3);

    // Get back to the main graph.
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();

    // Enter the subgraph, it should have the same node count.
    await enterSubgraph(page, nodeContainingSubgraph);
    expect(await nodes.count()).toBe(3);
});
