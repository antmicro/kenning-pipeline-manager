import { test, expect, Page, Locator } from '@playwright/test';
import { getPathToJsonFile, getUrl, openFileChooser } from './config.js';

const countOfInitiallyExposedInterface = 4;

async function enterSubgraph(page: Page) {
    const nodeWithSubgraph = page.getByText('Test subgraph node #1').nth(1).locator('../..');
    await nodeWithSubgraph.locator('.__title').click({ button: 'right' });
    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Edit Subgraph');
    await contextMenuOption.click();
}

async function loadSubgraphSpecification(page: Page) {
    const fileChooser = await openFileChooser(page, 'specification');
    await fileChooser.setFiles(getPathToJsonFile('sample-subgraph-specification.json'));
}

async function loadSubgraphDataflow(page: Page) {
    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(getPathToJsonFile('sample-subgraph-dataflow.json'));
}

async function prepareSubgraphPage(page: Page) {
    await page.goto(getUrl());
    await loadSubgraphSpecification(page);
    await loadSubgraphDataflow(page);
}

async function verifyNodeCount(page: Page, expectedCount: number) {
    const nodes = page.locator('.node-container > div');
    expect(await nodes.count()).toBe(expectedCount);
}

async function leaveSubgraph(page: Page) {
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();
}

async function dragAndDrop(page: Page, locator: Locator, to: { x: number; y: number }) {
    await locator.hover();
    await page.mouse.down();
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();
}

test('test loading subgraph dataflow', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
});

test('test entering subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enterSubgraph(page);
    await verifyNodeCount(page, 2);
});

test('test coming back from subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);

    await enterSubgraph(page);
    await verifyNodeCount(page, 2);

    await leaveSubgraph(page);
    await verifyNodeCount(page, 4);
});

async function placeNewNode(page, location: { x: number; y: number }) {
    const showNodesButton = page.getByText('Show node browser').locator('../..');
    await showNodesButton.click();
    const firstCategoryLabel = page.getByText('First Category');
    await firstCategoryLabel.click();
    const nodeFromBrowser = page.getByText('Test node #').first();
    await dragAndDrop(page, nodeFromBrowser, location);
}

test('test preserving changes to subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);

    await enterSubgraph(page);
    await verifyNodeCount(page, 2);
    await placeNewNode(page, { x: 400, y: 200 });

    await verifyNodeCount(page, 3);

    await leaveSubgraph(page);
    await enterSubgraph(page);
    await verifyNodeCount(page, 3);
});

async function verifyInterfaceCount(page: Page, expectedNumber: number): Promise<Locator> {
    const nodeWithSubgraph = page.getByText('Test subgraph node #1').locator('../..');
    const exposedInterfaces = nodeWithSubgraph.locator('.__outputs > div');
    expect(await exposedInterfaces.count()).toBe(expectedNumber);
    return exposedInterfaces;
}

test('test visibility of newly exposed subgraph interface', async ({ page }) => {
    await prepareSubgraphPage(page);
    const exposedInterfaces = await verifyInterfaceCount(page, countOfInitiallyExposedInterface);

    await enterSubgraph(page);
    await placeNewNode(page, { x: 400, y: 200 });

    // Expose a new interface: right click on an interface and choose 'Expose Interface'.
    const newOutputInterface = page
        .getByText('Test node #1')
        .locator('../..')
        .locator('.__content .__port')
        .nth(4);
    await newOutputInterface.click({ button: 'right' });

    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Expose Interface');
    await contextMenuOption.click();

    // Get back to the main graph.
    await leaveSubgraph(page);

    // Check if the newly exposed interface is present.
    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface + 1);
});

test("test hiding and exposing subgraph's interface", async ({ page }) => {
    await prepareSubgraphPage(page);
    const exposedInterfaces = await verifyInterfaceCount(page, countOfInitiallyExposedInterface);

    await enterSubgraph(page);

    // Hide an exposed interface: invoke a interface's context menu and click the option.
    const exposedInterface = page
        .getByText('Test node #1')
        .locator('../..')
        .locator('.__content .__port')
        .nth(1);
    await exposedInterface.click({ button: 'right' });

    const privatizeContextMenuOption = page
        .locator('.baklava-context-menu')
        .getByText('Privatize Interface');
    await privatizeContextMenuOption.click();

    // Get back to the main graph.
    await leaveSubgraph(page);
    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface - 1);

    // Re-expose the currently hidden interface: invoke an interface's context menu and click the option.
    await enterSubgraph(page);
    await exposedInterface.click({ button: 'right' });
    const exposeContextMenuOption = page
        .locator('.baklava-context-menu')
        .getByText('Expose Interface');
    await exposeContextMenuOption.click();

    // Get back to the main graph.
    await leaveSubgraph(page);
    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface);
});

test('test renaming exposed interface', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);

    await enterSubgraph(page);
    await verifyNodeCount(page, 2);

    // Rename an exposed interface.
    const newName = 'previously_nonexistent_interface'
    await page.locator('.__port').nth(2).hover();
    await page.getByText('Subgraph Input').click();
    await page.getByPlaceholder('External name').fill(newName);
    await page.getByPlaceholder('External name').press('Enter');

    // Verify if the exposed interface's name has been changed.
    await leaveSubgraph(page);
    await verifyNodeCount(page, 4);
    await expect(page.locator('#container')).toContainText(newName);
});
