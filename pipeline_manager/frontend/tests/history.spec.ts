import {
    test, expect, Page, Locator,
} from '@playwright/test';
import {
    getUrl, loadVideoNodeId, addNode, dragAndDrop, closeTerminal, loadSpecification, loadDataflow,
} from './config.js';

async function deleteNode(page: Page, nodeId: string) {
    await closeTerminal(page);

    // Find the node and invoke a context menu with a right click.
    const loadVideoNode = page.locator(`#${nodeId}`);
    expect(loadVideoNode, {
        message: `The node with id ${nodeId} is expected to be visible before the remove operation.`,
    }).toBeVisible();
    const nodeTitle = loadVideoNode.locator('.__title');
    await nodeTitle.click({ button: 'right' });

    // Delete the node.
    const deleteButton = loadVideoNode.getByText('Delete', { exact: true });
    await deleteButton.click();
}

async function loadWebsite(page: Page, requiredNodeId: string) {
    await page.goto(getUrl());
    if (requiredNodeId) {
        await page.waitForSelector(`#${requiredNodeId}`);
    }
}

async function expectNode(exists: boolean, page: Page, nodeId: string, errorMessage: string) {
    const loc = page.locator(`#${nodeId}`);
    if (exists) {
        expect(loc, { message: errorMessage }).toBeVisible();
    } else {
        await loc.waitFor({ state: 'hidden' });
        expect(loc, { message: errorMessage }).not.toBeVisible();
    }
}

function getNode(page: Page, name: string): Locator {
    return page.locator(`.baklava-node[data-node-type="${name}"]`);
}

async function leaveSubgraph(page: Page) {
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();
}

async function enterSubgraph(node: Locator) {
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Go to graph');
    await contextMenuOption.click();
}

async function removeNode(node: Locator) {
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Delete');
    await contextMenuOption.click();
}

async function assertInputCount(node: Locator, count: number) {
    const inputs = await node
        .locator('.__interfaces .__inputs > div')
        .count();
    expect(inputs).toBe(count);
}

async function assertOutputCount(node: Locator, count: number) {
    const inputs = await node
        .locator('.__interfaces .__outputs > div')
        .count();
    expect(inputs).toBe(count);
}

async function renameNodeType(page: Page, oldName: string, newName: string) {
    const node = getNode(page, oldName).locator('.__title');
    await node.click({ button: 'right' });
    await node.getByText('Rename').click();
    await node.locator('.baklava-input').first().fill(newName);
    await node.locator('.baklava-input').first().press('Enter');
}

function getNodeInterfaces(page: Page, name: string, side: 'input' | 'output' | 'any' = 'any'): Locator {
    const ioClass = {
        any: '',
        input: '.__inputs',
        output: '.__outputs',
    }[side];

    return getNode(page, name).locator(`.__interfaces ${ioClass}`);
}

async function waitForSubgraph(page: Page, graphName: string) {
    const editorTitle = page.locator('.editorTitle');
    await expect(editorTitle.getByText(graphName)).toBeVisible();
}

function getContextMenuOption(page: Page, nodeName: string, optionName: string): Locator {
    return getNode(page, nodeName).locator('.baklava-context-menu').getByText(optionName);
}

test('test history by removing subgraph', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-subgraph-specification.json');
    await loadDataflow(page, 'sample-subgraph-dataflow.json');

    const subgraphNode = getNode(page, 'Test subgraph #1');
    // check current output count of Test subgraph #1
    await assertOutputCount(subgraphNode, 3);
    // go to Test subgraph #1 subgraph
    await enterSubgraph(subgraphNode);
    await waitForSubgraph(page, 'Test subgraph #1');
    // get all test nodes in subgraph
    const nodes = getNode(page, 'Test node #1');
    expect(await nodes.count()).toBe(2);
    // remove them
    await removeNode(nodes.first());
    await removeNode(nodes.last());
    // now subgraph node should have no exposed outputs
    await assertOutputCount(subgraphNode, 0);

    await waitForSubgraph(page, 'Example of a graph with graph nodes');

    // Undo subgraph removal
    await page.keyboard.press('Control+KeyZ');

    await enterSubgraph(subgraphNode);
    await waitForSubgraph(page, 'Test subgraph #1');
    // Undo nodes removal
    await page.keyboard.press('Control+KeyZ');
    // One extra to undo connection removal
    await page.keyboard.press('Control+KeyZ');
    await page.keyboard.press('Control+KeyZ');
    // Check test node count
    expect(await getNode(page, 'Test node #1').count()).toBe(2);

    await leaveSubgraph(page);
    // subgraph node should get back its exposed outputs
    await assertOutputCount(subgraphNode, 3);
});

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
    return getNode(page, 'SaveVideo').count();
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
test('test history by moving node', async ({ page }) => {
    // Load a website and wait until nodes are loaded.
    await loadWebsite(page, loadVideoNodeId);

    const node = page.locator(`#${loadVideoNodeId}`);
    const nodeTitleArea = node.locator('.__title');

    const oldPosition = await node.boundingBox() ?? { x: 0, y: 0 };
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
    expect(afterUndoBoundingBox, {
        message:
            'The position of the node was expected to get back to the previous position by using an undo action.',
    }).toStrictEqual(oldPosition);

    // Perform the redo action.
    await page.keyboard.press('Control+KeyY');
    await page.waitForTimeout(1000); // Wait for the redo action to complete

    // Check that the position is back to the old position.
    const afterRedoBoundingBox = await node.boundingBox();
    expect(afterRedoBoundingBox, {
        message: 'After redoing an action a node its position did not change but it should.',
    }).not.toStrictEqual(oldPosition);
});

async function removeConnection(page: Page, inputInterface: Locator) {
    const inputInterfaceLocation = await inputInterface.boundingBox() ?? { x: 0, y: 0 };
    const shiftToConnectionInPx = 50;
    await page.mouse.dblclick(
        inputInterfaceLocation.x + shiftToConnectionInPx,
        inputInterfaceLocation.y,
    );
}

test('test history by removing connection', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    const outputPort = page.locator(`#${loadVideoNodeId} .__content .__interfaces .__outputs .__port`);
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

    const outputPort = page.locator(`#${loadVideoNodeId} .__content .__interfaces .__outputs .__port`);
    const connections = page.locator('.connections-container').locator('g');

    await expect(connections, {
        message: 'The initial conditions of presence of six connections are not met.',
    }).toHaveCount(6);

    await removeConnection(page, outputPort);
    await expect(connections, { message: 'Removing a connection failed.' }).toHaveCount(5);

    const sourceInterface = getNodeInterfaces(page, 'LoadVideo').locator('.__port').first();
    const targetInterface = getNodeInterfaces(page, 'Filter2D', 'input').locator('.__port').first();

    const [sourcePosition, targetPosition]: [number, number][] = await Promise.all(
        [sourceInterface, targetInterface]
            .map(async (locator) => {
                const {
                    x, width, y, height,
                } = await locator.boundingBox() as {
                    x: number, y: number, width: number, height: number,
                };

                return [x + width / 2, y + height / 2];
            }));

    await page.mouse.move(...sourcePosition);
    await page.mouse.down();
    await page.mouse.move(...targetPosition, { steps: 2 });
    await page.mouse.up();

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
    const firstInputInterface = getNodeInterfaces(page, 'Filter2D', 'input').locator('div').first();
    expect(await firstInputInterface.innerText(), { message: errorMessage }).toBe(value);
}

test('test history by moving interface down', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    await firstInputInterfaceHasToBe(
        page,
        'input 1',
        'Initial conditions of the `LoadVideo` node having interface `input 1` as the first one are not met.',
    );

    // Open a context menu of an interface.
    await getNodeInterfaces(page, 'Filter2D', 'input').locator('> div').first().click({ button: 'right' });

    // Move the interface down.
    const moveDownOption = getContextMenuOption(page, 'Filter2D', 'Move Down');
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
    await getNodeInterfaces(page, 'Filter2D', 'input').locator('> div').nth(1).click({ button: 'right' });

    // Move the interface up.
    const moveUpOption = getContextMenuOption(page, 'Filter2D', 'Move Up');
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
    return getNodeInterfaces(page, 'Filter2D', type).locator('.__port').count();
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
    await getNodeInterfaces(page, 'Filter2D', 'input').locator('.__port').first().dblclick();
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
    await getNodeInterfaces(page, 'Filter2D', 'output').locator('.__port').first().dblclick();
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

    await deleteNode(page, loadVideoNodeId);

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

test('test history by editing node with connection', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);

    // At the beginning, six connections exist.
    const connections = page.locator('.connections-container').locator('g');
    await expect(connections, {
        message: 'The initial condition of six connections being present are not met.',
    }).toHaveCount(6);

    // Open a context menu of an interface.
    await getNodeInterfaces(page, 'Filter2D', 'input').locator('.__port').nth(1).click({ button: 'right' });

    // Move the interface up.
    const moveUpOption = getContextMenuOption(page, 'Filter2D', 'Move Up');
    await moveUpOption.click();
    await firstInputInterfaceHasToBe(page, 'kernel', 'An interface `input 1` was not moved up.');

    // Verify the number of connections.
    await expect(connections, {
        message: 'Editing a node should not affect the number of connections but it did.',
    }).toHaveCount(6);

    await page.keyboard.press('Control+KeyZ');
    await expect(connections, {
        message: 'Undo of node edit should restore its connections but it did not.',
    }).toHaveCount(6);

    await page.keyboard.press('Control+KeyY');
    await expect(connections, {
        message: 'Redo of node edit should restore its connections but it did not.',
    }).toHaveCount(6);
});
test('test history by renaming a node', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);
    const movieLocator = page.locator('.__title-label').getByText('LoadMovie');
    const videoLocator = page.locator('.__title-label').getByText('LoadVideo');

    await expect(videoLocator).toBeVisible();
    await renameNodeType(page, 'LoadVideo', 'LoadMovie');
    await expect(movieLocator).toBeVisible();
    await page.keyboard.press('Control+KeyZ');
    await expect(videoLocator).toBeVisible();
    await page.keyboard.press('Control+KeyY');
    await expect(movieLocator).toBeVisible();
});
test('test history by changing property value', async ({ page }) => {
    await loadWebsite(page, loadVideoNodeId);
    const gaussian = getNode(page, 'GaussianKernel');
    const sizeSection = gaussian.locator('.baklava-num-input').getByText('size').locator('..');
    const sizeVal = sizeSection.locator('.__value').first();
    expect(await sizeVal.innerText()).toBe('5');
    await sizeSection.locator('..').locator('.--dec').click();
    await page.mouse.click(200, 200);
    expect(await sizeVal.innerText()).toBe('4');
    await page.keyboard.press('Control+KeyZ');
    expect(await sizeVal.innerText()).toBe('5');
    await page.keyboard.press('Control+KeyY');
    expect(await sizeVal.innerText()).toBe('4');
});
