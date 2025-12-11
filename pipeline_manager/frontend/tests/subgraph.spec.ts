import { test, expect, Page, Locator } from '@playwright/test';
import { getPathToJsonFile, getUrl, openFileChooser, enableEditingNodes } from './config.js';

import YAML from 'yaml';

const countOfInitiallyExposedInterface = 3;

const countOfInitiallyExposedProperties = 1;

async function addInterface(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last();
    await node.click({ button: 'right', force: true });
    await page.getByText('Add interface').click();
    await page.getByRole('button', { name: 'Add interface' }).click();
}
async function addProperty(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last();
    await node.click({ button: 'right', force: true });
    await page.getByText('Add property').click();
    await page.getByRole('button', { name: 'Add property' }).click();
}
async function deleteProperty(page: Page, nodeName: string, propName: string) {
    const node = page.getByText(nodeName).last();
    await node.click({ button: 'right', force: true });
    await page.getByText('Delete property').click();
    await page.locator('.create-menu').last().getByText(propName).click();
    await page.getByRole('button', { name: 'Remove properties' }).click();
}
async function getYAML(page: Page, nodeName: string) {
    const re = new RegExp(`^${nodeName}$`, 'g');
    const node = page
        .locator('div')
        .filter({ hasText: re })
        .nth(3);
    await node.dblclick();

    const textarea = page.locator('textarea');
    const content = YAML.parse(await textarea.evaluate((el) => el.value));
    return content;
}

async function enterSubgraph(page: Page, nodeName: string) {
    const nodeWithSubgraph = page.getByText(nodeName).last().locator('../..');
    await nodeWithSubgraph.locator('.__title').click({ button: 'right' });
    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Go to graph');
    await contextMenuOption.click();
}

async function deleteNode(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last().locator('../..');
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Delete').last();
    await contextMenuOption.dispatchEvent('click');
}

async function checkForSubgraph(page: Page, nodeName: string) {
    const nodeWithSubgraph = page.getByText(nodeName).last().locator('../..');
    await nodeWithSubgraph.locator('.__title').click({ button: 'right' });
    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Go to graph');
    expect(await contextMenuOption.count()).toBe(1);
    await nodeWithSubgraph.locator('.__title').click({ button: 'right' });
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

async function addSubgraph(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last().locator('../..');
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Add subgraph');
    await contextMenuOption.click();
}

test('test loading subgraph dataflow', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
});

test('test entering subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enterSubgraph(page,'Test subgraph #1');
    await verifyNodeCount(page, 2);
});

test('test coming back from subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);

    await enterSubgraph(page,'Test subgraph #1');
    await verifyNodeCount(page, 2);

    await leaveSubgraph(page);
    await verifyNodeCount(page, 4);
});

async function placeNewNode(page, location: { x: number; y: number }) {
    const showNodesButton = page.getByText('Show node browser').locator('../..');
    await showNodesButton.click();
    const firstCategoryLabel = page.getByText('First Category');
    await firstCategoryLabel.click();
    const nodeFromBrowser = page.getByText('Test node #1').first();
    await dragAndDrop(page, nodeFromBrowser, location);
}

test('test preserving changes to subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);

    await enterSubgraph(page,'Test subgraph #1');
    await verifyNodeCount(page, 2);
    await placeNewNode(page, { x: 400, y: 200 });

    await verifyNodeCount(page, 3);

    await leaveSubgraph(page);
    await enterSubgraph(page,'Test subgraph #1');
    await verifyNodeCount(page, 3);
});

async function verifyInterfaceCount(page: Page, expectedNumber: number, nodeName: string): Promise<Locator> {
    const nodeWithSubgraph = page.getByText(nodeName).locator('../..');
    const exposedInterfaces = nodeWithSubgraph.locator('.__interfaces .__outputs > div');
    expect(await exposedInterfaces.count()).toBe(expectedNumber);
    return exposedInterfaces;
}
async function verifyPropertyCount(page: Page, nodeName:string, expectedNumber: number): Promise<Locator> {
    const nodeWithSubgraph = page.getByText(nodeName).locator('../..');
    // get all children
    const exposedProperties = nodeWithSubgraph.locator('.__properties > *');
    expect(await exposedProperties.count()).toBe(expectedNumber);
    return exposedProperties;
}

test('test visibility of newly exposed subgraph interface', async ({ page }) => {
    await prepareSubgraphPage(page);
    const exposedInterfaces = await verifyInterfaceCount(page, countOfInitiallyExposedInterface,'Test subgraph #1');

    await enterSubgraph(page,'Test subgraph #1');
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
    const exposedInterfaces = await verifyInterfaceCount(page, countOfInitiallyExposedInterface,'Test subgraph #1');

    await enterSubgraph(page,'Test subgraph #1');

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
    await enterSubgraph(page,'Test subgraph #1');
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

    await enterSubgraph(page,'Test subgraph #1');
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

test('modifying subgraph interfaces correctly reflected in yaml editor', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    await addInterface(page, 'Test subgraph #1');
    const content = await getYAML(page, 'Test subgraph #1');
    expect(await content.interfaces.length).toBe(2);
});

test('test adding exposed property', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    await enterSubgraph(page,'Test subgraph #1');
    await addProperty(page, 'Test node #1');

    const exposedProperty = page
        .getByText('New property')
        .nth(1);
    await exposedProperty.click({ button: 'right' });
    const privatizeContextMenuOption = page
        .locator('.baklava-context-menu')
        .getByText('Expose Property');
    await privatizeContextMenuOption.click();

    await leaveSubgraph(page);
    await expect(page.locator('#container')).toContainText('New property');
    await verifyPropertyCount(page,'Test subgraph #1', 2);

    await deleteProperty(page, 'Test subgraph #1', 'Sample option');

    // check if YAML specification is correctly saved
    const content = await getYAML(page, 'Test subgraph #1');
    expect(await content.properties.find((entry) => entry.name === 'New property')).toBe(undefined);
    expect(await content.properties.length).toBe(0);
});

test("test hiding and exposing subgrap's property", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    const propertyCount = await verifyPropertyCount(page,'Test subgraph #2',countOfInitiallyExposedProperties);
    await enableEditingNodes(page);
    await enterSubgraph(page,'Test subgraph #2');

    const exposedProperty = page
        .getByText('Test node #2')
        .locator('../..')
        .locator('.__content .__properties')
        .last();

    await exposedProperty.click({ button: 'right', force: true });
    const privatizeContextMenuOption = page
        .locator('.baklava-context-menu')
        .getByText('Privatize Property');
    await privatizeContextMenuOption.click();

    await leaveSubgraph(page);
    expect(await propertyCount.count()).toBe(countOfInitiallyExposedProperties-1);

    await enterSubgraph(page,'Test subgraph #2');

    await exposedProperty.click({ button: 'right', force: true });
    const exposeContextMenuOption = page
        .locator('.baklava-context-menu')
        .getByText('Expose Property');
    await exposeContextMenuOption.click();

    await leaveSubgraph(page);
    expect(await propertyCount.count()).toBe(countOfInitiallyExposedProperties);
});

test("test add subgraph", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);

    await addSubgraph(page,"Test node #1");
    await checkForSubgraph(page,"Test node #1");
});

test("test add subgraph, with sub-node", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    const exposedInterfaces = await verifyInterfaceCount(page, 1,"Test node #2");

    await addSubgraph(page,"Test node #2");
    await checkForSubgraph(page,"Test node #2");
    await enterSubgraph(page,"Test node #2");

    // check if a new node was added to new subgraph
    await verifyNodeCount(page,0);
    await placeNewNode(page, { x: 400, y: 200 });
    await verifyNodeCount(page,1);

    // Expose a new interface: right click on an interface and choose 'Expose Interface'.
    const newOutputInterface = page
        .getByText('Test node #1')
        .locator('../..')
        .locator('.__interfaces .__outputs > div')
        .last();
    await newOutputInterface.click({ button: 'right' });

    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Expose Interface');
    await contextMenuOption.click();

    await leaveSubgraph(page);

    // Check if the newly exposed interface is present.
    expect(await exposedInterfaces.count()).toBe(2);
});


test("test remove node with exposed interface", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    const exposedInterfaces = await verifyInterfaceCount(page, countOfInitiallyExposedInterface,'Test subgraph #1');

    await enterSubgraph(page,'Test subgraph #1');

    // check if a node has been removed from subgraph
    await verifyNodeCount(page,2);
    await deleteNode(page,"Test node #1");
    await verifyNodeCount(page,1);

    await leaveSubgraph(page);

    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface-2);
});

test("test remove node with exposed properties", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    const exposedProperties = await verifyPropertyCount(page,'Test subgraph #2',1);

    await enterSubgraph(page,'Test subgraph #2');

    // check if a node has been removed from subgraph
    await verifyNodeCount(page,5);
    await deleteNode(page,"Test node #2");
    await verifyNodeCount(page,4);

    await leaveSubgraph(page);

    expect(await exposedProperties.count()).toBe(0);
});
