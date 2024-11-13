import { test, expect, Page, Locator } from '@playwright/test';
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
    await dragAndDrop(page, node, x, y);
}


async function dragAndDrop(page: Page, locator: Locator, x: number, y: number) {
    await locator.hover();
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

test('test history by moving node', async ({ page }) => {
    // Load a website and wait until nodes are loaded.
    const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
    await loadWebsite(page, loadVideoNodeId);

    const node = page.locator(`#${loadVideoNodeId}`);
    const nodeTitleArea = node.locator('.__title');

    const oldPosition = await node.boundingBox();
    const newCoordinates = {
        x: oldPosition.x + 100, // Move 100 pixels to the right.
        y: oldPosition.y + 50   // Move 50 pixels down.
    };

    await dragAndDrop(page, nodeTitleArea, newCoordinates.x, newCoordinates.y);

    const newBoundingBox = await node.boundingBox();
    expect(newBoundingBox).not.toStrictEqual(oldPosition);

    // Perform the undo action.
    await page.keyboard.press('Control+KeyZ');

    // Check that the position is back to the old position.
    const afterUndoBoundingBox = await node.boundingBox();
    await expect(afterUndoBoundingBox).toStrictEqual(oldPosition);

    // Perform the redo action.
    await page.keyboard.press('Control+KeyY');
    await page.waitForTimeout(1000); // Wait for the redo action to complete

    // Check that the position is back to the old position.
    const afterRedoBoundingBox = await node.boundingBox();
    await expect(afterRedoBoundingBox).not.toStrictEqual(oldPosition);
});

async function removeConnection(page: Page, inputInterface: Locator) {
    const inputInterfaceLocation = await inputInterface.boundingBox();
    const shiftToConnectionInPx = 50;
    await page.mouse.dblclick(
        inputInterfaceLocation.x + shiftToConnectionInPx,
        inputInterfaceLocation.y
    );
}

test('test history by removing connection', async ({ page }) => {
    const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
    await loadWebsite(page, loadVideoNodeId);

    const outputPort = page.locator(`#${loadVideoNodeId} .__content .__outputs .__port`);
    const connections = page.locator('.connections-container').locator('g');

    // At the beginning, six connections exist.
    await expect(connections).toHaveCount(6);

    // Remove the connection.
    await removeConnection(page, outputPort);
    await expect(connections).toHaveCount(5);

    // Undo the removal.
    await page.keyboard.press('Control+KeyZ');
    await expect(connections).toHaveCount(6);

    // Redo the removal.
    await page.keyboard.press('Control+KeyY');
    await expect(connections).toHaveCount(5);
});

test('test history by adding connection', async ({ page }) => {
    const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
    await loadWebsite(page, loadVideoNodeId);

    const outputPort = page.locator(`#${loadVideoNodeId} .__content .__outputs .__port`);
    const connections = page.locator('.connections-container').locator('g');

    await expect(connections).toHaveCount(6);

    await removeConnection(page, outputPort);
    await expect(connections).toHaveCount(5);

    const sourceInterface = page.getByText('LoadVideo').nth(1).locator('../..').locator('.__port');
    const targetInterface = page.getByText('Filter2D').nth(1).locator('../..').locator('.__inputs').getByText('input 1').locator('..').locator('.__port');

    await sourceInterface.dragTo(targetInterface);
    await expect(connections).toHaveCount(6);

    await page.keyboard.press('Control+KeyZ');
    await expect(connections).toHaveCount(5);

    await page.keyboard.press('Control+KeyY');
    await expect(connections).toHaveCount(6);
});

async function firstInputInterfaceHasToBe(page: Page, value: string) {
    const firstInputInterface = page.getByText('Filter2D').nth(1).locator('../..').locator('.__inputs div').first();
    await expect(await firstInputInterface.innerText()).toBe(value);
}

test('test history by moving interface down', async ({ page }) => {
    const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
    await loadWebsite(page, loadVideoNodeId);

    await firstInputInterfaceHasToBe(page, 'input 1');

    // Open a context menu of an interface.
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    let interfaceInput1 = filter2dNode.locator('.__inputs').getByText('input 1').locator('..').locator('.__port');
    await interfaceInput1.click({button: 'right'});

    // Move the interface down.
    const moveDownOption = page.locator('.baklava-context-menu').getByText('Move Down');
    await moveDownOption.click();
    await firstInputInterfaceHasToBe(page, 'kernel');

    await page.keyboard.press('Control+KeyZ');
    await firstInputInterfaceHasToBe(page, 'input 1');

    await page.keyboard.press('Control+KeyY');
    await firstInputInterfaceHasToBe(page, 'kernel');
});

test('test history by moving interface up', async ({ page }) => {
    const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
    await loadWebsite(page, loadVideoNodeId);

    await firstInputInterfaceHasToBe(page, 'input 1');

    // Open a context menu of an interface.
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    let interfaceInput1 = filter2dNode.locator('.__inputs').getByText('kernel').locator('..').locator('.__port');
    await interfaceInput1.click({button: 'right'});

    // Move the interface down.
    const moveUpOption = page.locator('.baklava-context-menu').getByText('Move Up');
    await moveUpOption.click();
    await firstInputInterfaceHasToBe(page, 'kernel');

    await page.keyboard.press('Control+KeyZ');
    await firstInputInterfaceHasToBe(page, 'input 1');

    await page.keyboard.press('Control+KeyY');
    await firstInputInterfaceHasToBe(page, 'kernel');
});

async function countInterfaces(page: Page, type: 'input' | 'output'): Promise<number> {
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    return filter2dNode.locator(`.__${type}s .__port`).count();
}

test('test history by moving interface to left', async ({ page }) => {
    const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
    await loadWebsite(page, loadVideoNodeId);

    // Test an initial state.
    expect(await countInterfaces(page, 'input')).toBe(2);
    expect(await countInterfaces(page, 'output')).toBe(1);
    
    // Double click on an interface.
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    let interfaceInput1 = filter2dNode.locator('.__inputs').getByText('input 1').locator('..').locator('.__port');
    await interfaceInput1.dblclick();
    expect(await countInterfaces(page, 'input')).toBe(1);
    expect(await countInterfaces(page, 'output')).toBe(2);

    await page.keyboard.press('Control+KeyZ');
    expect(await countInterfaces(page, 'input')).toBe(2);
    expect(await countInterfaces(page, 'output')).toBe(1);

    await page.keyboard.press('Control+KeyY');
    expect(await countInterfaces(page, 'input')).toBe(1);
    expect(await countInterfaces(page, 'output')).toBe(2);
});

test('test history by moving interface to right', async ({ page }) => {
    const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
    await loadWebsite(page, loadVideoNodeId);

    // Test an initial state.
    expect(await countInterfaces(page, 'input')).toBe(2);
    expect(await countInterfaces(page, 'output')).toBe(1);
    
    // Double click on an interface.
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    let interfaceOutput1 = filter2dNode.locator('.__outputs').getByText('output 1').locator('..').locator('.__port');
    await interfaceOutput1.dblclick();
    expect(await countInterfaces(page, 'input')).toBe(1);
    expect(await countInterfaces(page, 'output')).toBe(2);

    await page.keyboard.press('Control+KeyZ');
    expect(await countInterfaces(page, 'input')).toBe(2);
    expect(await countInterfaces(page, 'output')).toBe(1);

    await page.keyboard.press('Control+KeyY');
    expect(await countInterfaces(page, 'input')).toBe(1);
    expect(await countInterfaces(page, 'output')).toBe(2);
});
