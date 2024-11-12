import { test, expect, Page } from '@playwright/test';
import { getUrl } from './config.js';

async function deleteNode(page: Page, nodeId: String) {
    // Find the node and invoke a context menu with a right click.
    const loadVideoNode = await page.locator(`#${nodeId}`);
    expect(loadVideoNode.isVisible());
    await loadVideoNode.click({
        button: 'right'
    });
    
    // Delete the node.
    const deleteButton = await page.getByText('Delete');
    await deleteButton.click();
}

async function loadWebsite(page: Page, requiredNodeId: String) {
    await page.goto(getUrl());
    if (requiredNodeId) {
        await page.waitForSelector(`#${requiredNodeId}`);
    }
}

async function expectNode(exists: boolean, page: Page, nodeId: String) {
    expect(await page.locator(`#${nodeId}`).isVisible()).toBe(exists);
}

async function enableNavigationBar(page: Page) {
    await page.mouse.move(500, 0);
    await page.locator('.hoverbox').filter({ hasText: /^Show node browser$/ }).first().click();
}

async function addNode(page: Page, category: string, nodeName: string, x: number, y: number) {
    const categoryBar = page.getByText(category);
    const node = page.getByText(nodeName).first();

    // Open a proper category.
    await enableNavigationBar(page);
    await categoryBar.click();

    // Drag and drop to the [x, y] position.
    await node.hover();
    await page.mouse.down();
    await page.mouse.move(x, y);
    await page.mouse.up();
}

test('test history by removing node', async ({ page }) => {
    // Load a website and wait until nodes are loaded.
    const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
    await loadWebsite(page, loadVideoNodeId);

    await deleteNode(page, loadVideoNodeId);
    await expectNode(false, page, loadVideoNodeId);

    await page.keyboard.press('Control+KeyZ');
    await expectNode(true, page, loadVideoNodeId);

    await page.keyboard.press('Control+KeyY');
    await expectNode(false, page, loadVideoNodeId);
});

async function countSaveVideoNodes(page: Page): Promise<number> {
    const saveVideoNodes = page.getByText('SaveVideo').locator('../..').getByText('SaveVideofilename: frames').count();
    return saveVideoNodes;
}

test('test history by adding node', async ({ page }) => {
    // Load a website and wait until nodes are loaded.
    const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
    await loadWebsite(page, loadVideoNodeId);

    await addNode(page, 'Filesystem', 'SaveVideo', 750, 80);
    // An initial node and a newly added one makes two.
    expect(await countSaveVideoNodes(page)).toBe(2);

    await page.keyboard.press('Control+KeyZ');
    expect(await countSaveVideoNodes(page)).toBe(1);

    await page.keyboard.press('Control+KeyY');
    expect(await countSaveVideoNodes(page)).toBe(2);
});
