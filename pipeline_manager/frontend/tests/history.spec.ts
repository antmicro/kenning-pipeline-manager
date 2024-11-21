import { test, expect, Page, Locator } from '@playwright/test';
import { getUrl, loadVideoNodeId } from './config.js';

async function deleteNode(page: Page, nodeId: string) {
    // Find the node and invoke a context menu with a right click.
    const loadVideoNode = page.locator(`#${nodeId}`);
    expect(loadVideoNode, {
        message: `The node with id ${nodeId} is expected to be visible before the remove operation.`,
    }).toBeVisible();
    await loadVideoNode.click({
        button: 'right',
    });

    // Delete the node.
    const deleteButton = await page.getByText('Delete');
    await deleteButton.click();
}

async function loadWebsite(page: Page, requiredNodeId: string) {
    await page.goto(getUrl());
    if (requiredNodeId) {
        await page.waitForSelector(`#${requiredNodeId}`);
    }
}

async function expectNode(exists: boolean, page: Page, nodeId: string, errorMessage: string) {
    expect(page.locator(`#${nodeId}`), { message: errorMessage }).toBeVisible({ visible: exists });
}

async function enableNavigationBar(page: Page) {
    await page.mouse.move(500, 0);
    await page
        .locator('.hoverbox')
        .filter({ hasText: /^Show node browser$/ })
        .first()
        .click();
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
    await loadWebsite(page, loadVideoNodeId);

    await deleteNode(page, loadVideoNodeId);
    await expectNode(
        false,
        page,
        loadVideoNodeId,
        'The `LoadVideo` node is visible after removing it.',
    );

    await page.keyboard.press('Control+KeyZ');
    await expectNode(
        true,
        page,
        loadVideoNodeId,
        'The `LoadVideo` node is not visible after undoing the remove operation.',
    );

    await page.keyboard.press('Control+KeyY');
    await expectNode(
        false,
        page,
        loadVideoNodeId,
        'The `LoadVideo` node is visible after redoing the remove operation.',
    );
});

async function countSaveVideoNodes(page: Page): Promise<number> {
    const saveVideoNodes = page
        .getByText('SaveVideo')
        .locator('../..')
        .getByText('SaveVideofilename: frames')
        .count();
    return saveVideoNodes;
}

test('test history by adding node', async ({ page }) => {
    // Load a website and wait until nodes are loaded.
    await loadWebsite(page, loadVideoNodeId);

    await addNode(page, 'Filesystem', 'SaveVideo', 750, 80);
    // An initial node and a newly added one makes two.
    expect(await countSaveVideoNodes(page), {
        message: 'Two nodes entitled `SaveVideo` should exist after the second one was added.',
    }).toBe(2);

    await page.keyboard.press('Control+KeyZ');
    expect(await countSaveVideoNodes(page), {
        message: 'One node entitled `SaveVideo` should exist after undoing an add action.',
    }).toBe(1);

    await page.keyboard.press('Control+KeyY');
    expect(await countSaveVideoNodes(page), {
        message: 'Two nodes entitled `SaveVideo` should exist after redoing the add action.',
    }).toBe(2);
});

// Undo & redo action triggered by Ctrl+Z and Ctrl+Y respectively,
// do not undo and redo the move operation of a node.
test.fixme('test history by moving node', async ({ page }) => {
    // Load a website and wait until nodes are loaded.
    await loadWebsite(page, loadVideoNodeId);

    const node = page.locator(`#${loadVideoNodeId}`);
    const nodeTitleArea = node.locator('.__title');

    const oldPosition = await node.boundingBox();
    const newCoordinates = {
        x: oldPosition.x + 100, // Move 100 pixels to the right.
        y: oldPosition.y + 50, // Move 50 pixels down.
    };

    await dragAndDrop(page, nodeTitleArea, newCoordinates.x, newCoordinates.y);

    const newBoundingBox = await node.boundingBox();
    expect(newBoundingBox, {
        message: 'After dragging and dropping a node its position did not change but it should.',
    }).not.toStrictEqual(oldPosition);

    // Perform the undo action.
    await page.keyboard.press('Control+KeyZ');

    // Check that the position is back to the old position.
    const afterUndoBoundingBox = await node.boundingBox();
    await expect(afterUndoBoundingBox, {
        message:
            'The position of the node was expected to get back to the previous position by using an undo action.',
    }).toStrictEqual(oldPosition);

    // Perform the redo action.
    await page.keyboard.press('Control+KeyY');
    await page.waitForTimeout(1000); // Wait for the redo action to complete

    // Check that the position is back to the old position.
    const afterRedoBoundingBox = await node.boundingBox();
    await expect(afterRedoBoundingBox, {
        message: 'After redoing an action a node its position did not change but it should.',
    }).not.toStrictEqual(oldPosition);
});

async function removeConnection(page: Page, inputInterface: Locator) {
    const inputInterfaceLocation = await inputInterface.boundingBox();
    const shiftToConnectionInPx = 50;
    await page.mouse.dblclick(
        inputInterfaceLocation.x + shiftToConnectionInPx,
        inputInterfaceLocation.y,
    );
}

test('test history by removing connection', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    const outputPort = page.locator(`#${loadVideoNodeId} .__content .__outputs .__port`);
    const connections = page.locator('.connections-container').locator('g');

    await expect(connections, {
        message: 'The initial conditions of presence of six connections are not met.',
    }).toHaveCount(6);

    await removeConnection(page, outputPort);
    await expect(connections, { message: 'Removing a connection failed.' }).toHaveCount(5);

    await page.keyboard.press('Control+KeyZ');
    await expect(connections, {
        message: 'Undoing the removal of a connection was not successful.',
    }).toHaveCount(6);

    // Redo the removal.
    await page.keyboard.press('Control+KeyY');
    await expect(connections, {
        message: 'Redoing the removal a of a connection was not successful.',
    }).toHaveCount(5);
});

test('test history by adding connection', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    const outputPort = page.locator(`#${loadVideoNodeId} .__content .__outputs .__port`);
    const connections = page.locator('.connections-container').locator('g');

    await expect(connections, {
        message: 'The initial conditions of presence of six connections are not met.',
    }).toHaveCount(6);

    await removeConnection(page, outputPort);
    await expect(connections, { message: 'Removing a connection failed.' }).toHaveCount(5);

    const sourceInterface = page.getByText('LoadVideo').nth(1).locator('../..').locator('.__port');
    const targetInterface = page
        .getByText('Filter2D')
        .nth(1)
        .locator('../..')
        .locator('.__inputs')
        .getByText('input 1')
        .locator('..')
        .locator('.__port');

    await sourceInterface.dragTo(targetInterface);
    await expect(connections, {
        message: 'Adding a connection (in place of a missing connection) failed.',
    }).toHaveCount(6);

    await page.keyboard.press('Control+KeyZ');
    await expect(connections, {
        message: 'Undoing of the action of adding a connection failed.',
    }).toHaveCount(5);

    await page.keyboard.press('Control+KeyY');
    await expect(connections, {
        message: 'Redoing of the action of adding a connection failed.',
    }).toHaveCount(6);
});

async function firstInputInterfaceHasToBe(page: Page, value: string, errorMessage: string) {
    const firstInputInterface = page
        .getByText('Filter2D')
        .nth(1)
        .locator('../..')
        .locator('.__inputs div')
        .first();
    await expect(await firstInputInterface.innerText(), { message: errorMessage }).toBe(value);
}

test('test history by moving interface down', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    await firstInputInterfaceHasToBe(
        page,
        'input 1',
        'Initial conditions of the `LoadVideo` node having interface `input 1` as the first one are not met.',
    );

    // Open a context menu of an interface.
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    let interfaceInput1 = filter2dNode
        .locator('.__inputs')
        .getByText('input 1')
        .locator('..')
        .locator('.__port');
    await interfaceInput1.click({ button: 'right' });

    // Move the interface down.
    const moveDownOption = page.locator('.baklava-context-menu').getByText('Move Down');
    await moveDownOption.click();
    await firstInputInterfaceHasToBe(page, 'kernel', 'An interface `input 1` was not moved down.');

    await page.keyboard.press('Control+KeyZ');
    await firstInputInterfaceHasToBe(
        page,
        'input 1',
        'Undoing the action of moving down an interface failed.',
    );

    await page.keyboard.press('Control+KeyY');
    await firstInputInterfaceHasToBe(
        page,
        'kernel',
        'Redoing the action of moving down an interface failed.',
    );
});

test('test history by moving interface up', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    await firstInputInterfaceHasToBe(
        page,
        'input 1',
        'Initial conditions of the `LoadVideo` node having interface `input 1` as the first one are not met.',
    );

    // Open a context menu of an interface.
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    let interfaceInput1 = filter2dNode
        .locator('.__inputs')
        .getByText('kernel')
        .locator('..')
        .locator('.__port');
    await interfaceInput1.click({ button: 'right' });

    // Move the interface up.
    const moveUpOption = page.locator('.baklava-context-menu').getByText('Move Up');
    await moveUpOption.click();
    await firstInputInterfaceHasToBe(page, 'kernel', 'An interface `input 1` was not moved up.');

    await page.keyboard.press('Control+KeyZ');
    await firstInputInterfaceHasToBe(
        page,
        'input 1',
        'Undoing the action of moving up an interface failed.',
    );

    await page.keyboard.press('Control+KeyY');
    await firstInputInterfaceHasToBe(
        page,
        'kernel',
        'Redoing the action of moving ip an interface failed',
    );
});

async function countInterfaces(page: Page, type: 'input' | 'output'): Promise<number> {
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    return filter2dNode.locator(`.__${type}s .__port`).count();
}

test('test history by moving interface to right', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    expect(await countInterfaces(page, 'input'), {
        message: 'The initial conditions are not met.',
    }).toBe(2);
    expect(await countInterfaces(page, 'output'), {
        message: 'The initial conditions are not met.',
    }).toBe(1);

    // Double click on an interface.
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    let interfaceInput1 = filter2dNode
        .locator('.__inputs')
        .getByText('input 1')
        .locator('..')
        .locator('.__port');
    await interfaceInput1.dblclick();
    expect(await countInterfaces(page, 'input'), {
        message: 'An interface was not moved to the right after double clicking it.',
    }).toBe(1);
    expect(await countInterfaces(page, 'output'), {
        message: 'An interface was not moved to the right after double clicking it.',
    }).toBe(2);

    // Click on another node to enable undo.
    const node = page.locator(`#${loadVideoNodeId}`);
    await node.click();

    await page.keyboard.press('Control+KeyZ');
    expect(await countInterfaces(page, 'input'), {
        message: 'Undoing of moving an interface to the right failed.',
    }).toBe(2);
    expect(await countInterfaces(page, 'output'), {
        message: 'Undoing of moving an interface to the right failed.',
    }).toBe(1);

    await page.keyboard.press('Control+KeyY');
    expect(await countInterfaces(page, 'input'), {
        message: 'Redoing of moving an interface to the right failed.',
    }).toBe(1);
    expect(await countInterfaces(page, 'output'), {
        message: 'Redoing of moving an interface to the right failed.',
    }).toBe(2);
});

test('test history by moving interface to left', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    expect(await countInterfaces(page, 'input'), {
        message: 'The initial conditions are not met.',
    }).toBe(2);
    expect(await countInterfaces(page, 'output'), {
        message: 'The initial conditions are not met.',
    }).toBe(1);

    // Double click on an interface.
    const filter2dNode = page.getByText('Filter2D').nth(1).locator('../..');
    let interfaceOutput1 = filter2dNode
        .locator('.__outputs')
        .getByText('output 1')
        .locator('..')
        .locator('.__port');
    await interfaceOutput1.dblclick();
    expect(await countInterfaces(page, 'input'), {
        message: 'An interface was not moved to the left after double clicking it.',
    }).toBe(3);
    expect(await countInterfaces(page, 'output'), {
        message: 'An interface was not moved to the left after double clicking it.',
    }).toBe(0);

    // Click on another node to enable undo.
    const node = page.locator(`#${loadVideoNodeId}`);
    await node.click();

    await page.keyboard.press('Control+KeyZ');
    expect(await countInterfaces(page, 'input'), {
        message: 'Moving an interface to the left cannot be undone.',
    }).toBe(2);
    expect(await countInterfaces(page, 'output'), {
        message: 'Moving an interface to the left cannot be undone.',
    }).toBe(1);

    await page.keyboard.press('Control+KeyY');
    expect(await countInterfaces(page, 'input'), {
        message: 'Moving an interface to the left cannot be redone.',
    }).toBe(3);
    expect(await countInterfaces(page, 'output'), {
        message: 'Moving an interface to the left cannot be redone.',
    }).toBe(0);
});

test('test history by removing node with connection', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    // At the beginning, six connections exist.
    const connections = page.locator('.connections-container').locator('g');
    await expect(connections, {
        message: 'The initial condition of six connections being present are not met.',
    }).toHaveCount(6);

    // Delete a node.
    const loadVideoNode = await page.locator(`#${loadVideoNodeId}`);
    expect(loadVideoNode.isVisible());
    await loadVideoNode.click({ button: 'right' });
    const deleteButton = await page.getByText('Delete');
    await deleteButton.click();

    // Verify that the node and its connection have disappeared.
    await expect(page.locator(`#${loadVideoNodeId}`), {
        message: 'Node should not be visible after it is removed.',
    }).not.toBeVisible();
    await expect(connections, {
        message: 'A connection of a removed node should disappear but it did not.',
    }).toHaveCount(5);

    await page.keyboard.press('Control+KeyZ');
    await expect(connections, {
        message: 'Undo of removal of a node should restore its connections but it did not.',
    }).toHaveCount(6);

    await page.keyboard.press('Control+KeyY');
    await expect(connections, {
        message: 'Redo of removal of a node should restore remove its connections but it did not.',
    }).toHaveCount(5);
});
