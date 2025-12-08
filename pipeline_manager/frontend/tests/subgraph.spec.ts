import { test, expect, Page, Locator } from '@playwright/test';
import { getPathToJsonFile, getUrl, openFileChooser, enableEditingNodes, enableNavigationBar, addNode } from './config.js';

import os from 'os';
import fs from 'fs';
import YAML from 'yaml';
import path from 'path';

const countOfInitiallyExposedInterface = 3;

const countOfInitiallyExposedProperties = 1;

const temporaryDir = os.tmpdir() + '/';

function getNode(page: Page, nodeName: string) {
    return page.locator(`.baklava-node[data-node-type="${nodeName}"]`);
}

async function addInterface(page: Page, node: Locator) {
    await node.locator('.__title').click({ button: 'right', force: true });
    await node.locator('.baklava-context-menu').getByText('Add interface').click();
    await page.getByRole('button', { name: 'Add interface' }).click();
}
async function addProperty(page: Page, node: Locator) {
    await node.locator('.__title').click({ button: 'right', force: true });
    await node.locator('.baklava-context-menu').getByText('Add property').click();
    await page.getByRole('button', { name: 'Add property' }).click();
}
async function deleteProperty(page: Page, node: Locator, propName: string) {
    await node.locator('.__title').click({ button: 'right', force: true });
    await node.locator('.baklava-context-menu').getByText('Delete property').click();
    await page.locator('.create-menu').last().getByText(propName).click();
    await page.getByRole('button', { name: 'Remove properties' }).click();
}
async function getYAML(page: Page, node: Locator) {
    await node.locator('.__title').dblclick();

    const textarea = page.locator('textarea');
    const content = YAML.parse(await textarea.evaluate((el) => el.value));
    return content;
}
async function setYAML(page: Page, content: string, node: Locator) {
    await node.locator('.__title').dblclick();

    const textarea = page.locator('textarea');
    await textarea.fill(YAML.stringify(content));
}

async function enterSubgraph(node: Locator) {
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Go to graph');
    await contextMenuOption.click();
}

async function deleteNode(node: Locator) {
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Delete').last();
    await contextMenuOption.dispatchEvent('click');
}

async function checkForSubgraph(node: Locator) {
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Go to graph');
    expect(await contextMenuOption.count()).toBe(1);
    await node.locator('.__title').click({ button: 'right' });
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
    try {
        await page.locator('.zoom-center').click({ timeout: 1000 });
    } catch {
        // not clickable, could be hidden by node config panel
    }
}

async function dragAndDrop(page: Page, locator: Locator, to: { x: number; y: number }) {
    await locator.hover();
    await page.mouse.down();
    await page.mouse.move(to.x, to.y);
    await page.mouse.up();
}

async function addSubgraph(node: Locator) {
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Add subgraph');
    await contextMenuOption.click();
}

test('test loading subgraph dataflow', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
});

test('test entering subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enterSubgraph(getNode(page, 'Test subgraph #1'));
    await verifyNodeCount(page, 2);
});

test('test coming back from subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);

    await enterSubgraph(getNode(page, 'Test subgraph #1'));
    await verifyNodeCount(page, 2);

    await leaveSubgraph(page);
    await verifyNodeCount(page, 4);
});

async function placeNewNode(page: Page, location: { x: number; y: number }) {
    await enableNavigationBar(page);
    const firstCategoryLabel = page.getByText('First Category');
    await firstCategoryLabel.click();
    const nodeFromBrowser = page.getByText('Test node #1').first();
    await dragAndDrop(page, nodeFromBrowser, location);
}

async function createNewNode(page: Page, location: { x: number; y: number }) {
    await enableNavigationBar(page);
    const newNodeType = page.getByText('New Node Type').first();
    await dragAndDrop(page, newNodeType, location);
    const createButton = page.getByText('Create').first();
    await createButton.click();
}

async function createNewGraphNode(page: Page, location: { x: number; y: number }) {
    await enableNavigationBar(page);
    const newGraphNodeType = page.getByText('New Graph Node').first();
    await dragAndDrop(page, newGraphNodeType, location);
}

test('test preserving changes to subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);

    const subgraphNode = getNode(page, 'Test subgraph #1')
    await enterSubgraph(subgraphNode);
    await verifyNodeCount(page, 2);
    await placeNewNode(page, { x: 400, y: 200 });

    await verifyNodeCount(page, 3);

    await leaveSubgraph(page);
    await enterSubgraph(subgraphNode);
    await verifyNodeCount(page, 3);
});

async function verifyInterfaceCount(expectedNumber: number, node: Locator): Promise<Locator> {
    const exposedInterfaces = node.locator('.__interfaces .__outputs > div').filter({ hasText: /\S/ });
    expect(await exposedInterfaces.count()).toBe(expectedNumber);
    return exposedInterfaces;
}
async function verifyPropertyCount(node: Locator, expectedNumber: number): Promise<Locator> {
    // get all children
    const exposedProperties = node.locator('.__properties > *').filter({ hasText: /\S/ });
    expect(await exposedProperties.count()).toBe(expectedNumber);
    return exposedProperties;
}

test('test visibility of newly exposed subgraph interface', async ({ page }) => {
    await prepareSubgraphPage(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    const exposedInterfaces = await verifyInterfaceCount(countOfInitiallyExposedInterface, subgraphNode);

    await enterSubgraph(subgraphNode);
    await placeNewNode(page, { x: 400, y: 200 });

    // Expose a new interface: right click on an interface and choose 'Expose Interface'.
    const node = getNode(page, 'Test node #1').last();
    const newOutputInterface = node
        .locator('.__content .__outputs .__port')
        .nth(1);
    await newOutputInterface.click({ button: 'right' });
    const menu = node.locator('.__content .baklava-context-menu').first();
    const contextMenuOption = menu.getByText('Expose Interface');
    await contextMenuOption.click();

    // Get back to the main graph.
    await leaveSubgraph(page);

    // Check if the newly exposed interface is present.
    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface + 1);
});

test("test hiding and exposing subgraph's interface", async ({ page }) => {
    await prepareSubgraphPage(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    const exposedInterfaces = await verifyInterfaceCount(countOfInitiallyExposedInterface, subgraphNode);

    await enterSubgraph(subgraphNode);

    // Hide an exposed interface: invoke a interface's context menu and click the option.
    const targetNode = getNode(page, 'Test node #1').nth(1);
    const exposedInterface = targetNode
        .locator('.__content .__port')
        .nth(1);
    await exposedInterface.click({ button: 'right' });

    const privatizeContextMenuOption = targetNode
        .locator('.baklava-context-menu')
        .getByText('Privatize Interface');
    await privatizeContextMenuOption.click();

    // Get back to the main graph.
    await leaveSubgraph(page);
    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface - 1);

    // Re-expose the currently hidden interface: invoke an interface's context menu and click the option.
    await enterSubgraph(subgraphNode);
    await exposedInterface.click({ button: 'right' });
    const exposeContextMenuOption = targetNode
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

    const subgraphNode = getNode(page, 'Test subgraph #1');
    await enterSubgraph(subgraphNode);
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
    const subgraphNode = getNode(page, 'Test subgraph #1');
    await addInterface(page, subgraphNode);
    const content = await getYAML(page, subgraphNode);
    expect(await content.interfaces.length).toBe(2);
});

test('modifying subgraph properties correctly reflected in yaml editor', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    await addProperty(page, subgraphNode);
    const content = await getYAML(page, subgraphNode);
    expect(await content.properties.length).toBe(2);
});

test('test adding exposed property', async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    await enterSubgraph(subgraphNode);
    const node = getNode(page, 'Test node #1').first();
    await addProperty(page, node);

    const exposedProperty = node
        .getByText('New property');
    await exposedProperty.click({ button: 'right' });
    const privatizeContextMenuOption = node
        .locator('.baklava-context-menu')
        .getByText('Expose Property');
    await privatizeContextMenuOption.click();

    await leaveSubgraph(page);
    await expect(page.locator('#container')).toContainText('New property');
    await verifyPropertyCount(subgraphNode, 2);

    await deleteProperty(page, subgraphNode, 'Sample option');

    // check if YAML specification is correctly saved
    const content = await getYAML(page, subgraphNode);
    expect(await content.properties.find((entry) => entry.name === 'New property')).toBe(undefined);
    expect(await content.properties.length).toBe(0);
});

test("test hiding and exposing subgrap's property", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    const subgraphNode = getNode(page, 'Test subgraph #2');
    const propertyCount = await verifyPropertyCount(subgraphNode, countOfInitiallyExposedProperties);
    await enableEditingNodes(page);
    await enterSubgraph(subgraphNode);

    const targetNode = getNode(page, 'Test node #2');
    const exposedProperty = targetNode
        .locator('.__content .__properties')
        .last();

    await exposedProperty.click({ button: 'right', force: true });
    const privatizeContextMenuOption = targetNode
        .locator('.baklava-context-menu')
        .getByText('Privatize Property');
    await privatizeContextMenuOption.click();

    await leaveSubgraph(page);
    expect(await propertyCount.count()).toBe(countOfInitiallyExposedProperties-1);

    await enterSubgraph(subgraphNode);

    await exposedProperty.click({ button: 'right', force: true });
    const exposeContextMenuOption = targetNode
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

    const node = getNode(page, 'Test node #1')
    await addSubgraph(node);
    await checkForSubgraph(node);
});

test("test add subgraph, with sub-node", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test node #2')
    const exposedInterfaces = await verifyInterfaceCount(1, subgraphNode);

    await addSubgraph(subgraphNode);
    await checkForSubgraph(subgraphNode);
    await enterSubgraph(subgraphNode);

    // check if a new node was added to new subgraph
    await verifyNodeCount(page,0);
    await placeNewNode(page, { x: 400, y: 200 });
    await verifyNodeCount(page,1);

    // Expose a new interface: right click on an interface and choose 'Expose Interface'.
    const node = getNode(page, 'Test node #1')
    await node.locator('.__interfaces .__outputs > div')
        .last()
        .click({ button: 'right' });

    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Expose Interface');
    await contextMenuOption.click();

    await leaveSubgraph(page);

    // Check if the newly exposed interface is present.
    expect(await exposedInterfaces.count()).toBe(2);
});


test("test remove node with exposed interface", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    const exposedInterfaces = await verifyInterfaceCount(countOfInitiallyExposedInterface, subgraphNode);

    await enterSubgraph(subgraphNode);

    // check if a node has been removed from subgraph
    await verifyNodeCount(page,2);
    await deleteNode(getNode(page, 'Test node #1').nth(1));
    await verifyNodeCount(page,1);

    await leaveSubgraph(page);

    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface-2);
});

test("test remove node with exposed properties", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #2');
    const exposedProperties = await verifyPropertyCount(subgraphNode, 1);

    await enterSubgraph(subgraphNode);

    // check if a node has been removed from subgraph
    await verifyNodeCount(page,5);
    await deleteNode(getNode(page, 'Test node #2'));
    await verifyNodeCount(page,4);

    await leaveSubgraph(page);

    expect(await exposedProperties.count()).toBe(0);
});

test("test new node type creation", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);

    await createNewNode(page,{x:400,y:400});

    // check if a new node type has been added
    await verifyNodeCount(page,5);
});

test("test new graph node creation", async ({ page }) => {
    await prepareSubgraphPage(page);
    await verifyNodeCount(page, 4);
    await enableEditingNodes(page);

    await createNewGraphNode(page,{x:400,y:400});

    // check if a new node type has been added
    await verifyNodeCount(page,5);

    // enter into a new graph node
    const subgraphNode = getNode(page, 'New Graph Node');
    await enterSubgraph(subgraphNode);

    // add a node
    await verifyNodeCount(page,0);
    await placeNewNode(page,{x:400,y:400});
    await verifyNodeCount(page,1);

    // expose a interface
    const newOutputInterface = getNode(page, 'Test node #1')
        .locator('.__content .__outputs .__port')
        .first();
    await newOutputInterface.click({ button: 'right' });

    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Expose Interface');
    await contextMenuOption.click();

    await leaveSubgraph(page);

    await verifyInterfaceCount(1, subgraphNode);
});
test('test changing node interfaces from upper level', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    await verifyInterfaceCount(3, subgraphNode);
    const testNode = getNode(page, 'Test node #1').first();
    await testNode.locator('.__title').click({ button: 'right' });
    await testNode.getByText('Delete interface').click();
    await page.locator('.baklava-checkbox').getByText('Inout').click();
    await page.getByRole('button', { name: 'Remove interfaces' }).click();
    await verifyInterfaceCount(1, subgraphNode);
});
test('test changing node properties from upper level', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #2');
    await verifyPropertyCount(subgraphNode, 1);
    const testNode = getNode(page, 'Test node #2').first();
    await testNode.locator('.__title').click({ button: 'right' });
    await testNode.getByText('Delete property').click();
    await page.locator('.baklava-checkbox').getByText('Sample option').click();
    await page.getByRole('button', { name: 'Remove properties' }).click();
    await verifyPropertyCount(subgraphNode, 0);
});
async function saveSpecificationAs(page: Page, filenameWithoutExtension: string): Promise<string> {
    const logo = page.locator('.logo');
    await logo.hover();
    const saveAsMenuOption = page.getByRole('button', { name: 'Save specification as...' });
    await saveAsMenuOption.click();

    await page.getByPlaceholder('File name').first().fill(filenameWithoutExtension);
    const saveAsButton = page.getByRole('button', { name: 'Save' });

    const downloadPromise = page.waitForEvent('download');
    await saveAsButton.click();
    const download = await downloadPromise;

    const downloadedFilePath = temporaryDir + download.suggestedFilename();
    await download.saveAs(downloadedFilePath);

    return downloadedFilePath;
}
test('test inherited subgraph from specification', async ({ page }) => {
    await prepareSubgraphPage(page);

    const parentIntfs = await getNode(page, 'Test subgraph #2').locator('.__interfaces').locator('[id]').count();
    const parentProps = await getNode(page, 'Test subgraph #2').locator('.__properties').locator('[id]').count();

    const specificationPath = getPathToJsonFile('sample-subgraph-specification.json');
    const raw = fs.readFileSync(specificationPath, 'utf-8');
    const json = JSON.parse(raw);
    json.nodes.push({
        name: 'InheritedSubgraph',
        category: 'Test',
        properties: [
            {
                name: 'Message',
                type: 'text',
                default: 'this is my prop!',
            },
        ],
        extends: ['Test subgraph #2'],
    });
    const outputPath = path.join(temporaryDir, 'modified-specification.json');
    fs.writeFileSync(outputPath, JSON.stringify(json, null, 2), 'utf-8');

    // load the specification with inherited subgraph
    const fileChooserSpec = await openFileChooser(page, 'specification');
    await fileChooserSpec.setFiles(outputPath);
    await enableEditingNodes(page);
    await addNode(page, 'Test', 'InheritedSubgraph', 400, 160);
    const nodeAfterLoad = getNode(page, 'InheritedSubgraph');
    await page.waitForTimeout(3000);
    // expect number of interfaces that subgraph #1 has
    expect(await nodeAfterLoad.locator('.__interfaces').locator('[id]').count()).toBe(parentIntfs);
    expect(await nodeAfterLoad.locator('.__properties').locator('[id]').count()).toBe(parentProps + 1);
    await enterSubgraph(getNode(page, 'InheritedSubgraph'));
    await verifyNodeCount(page, 5);
});
test('test inherited subgraph', async ({ page }) => {
    test.skip(true, 'Currently resolving inheritance for subgraphs during runtime is not supported');
    await page.goto(getUrl());
    const fileChooserSpec = await openFileChooser(page, 'specification');
    await fileChooserSpec.setFiles(getPathToJsonFile('sample-inheritance-specification.json'));
    const fileChooserData = await openFileChooser(page, 'dataflow');
    await fileChooserData.setFiles(getPathToJsonFile('sample-inheritance-dataflow.json'));
    await enableEditingNodes(page);

    const nodeA = page.locator('[data-node-type="Type A"]');
    await nodeA.locator('.__title').click({ button: 'right', force: true });
    await page.getByText('Add and edit subgraph').click();

    await addNode(page, 'Classes', 'Type C', 750, 80);
    const newOutputInterface = page
        .locator('[data-node-type="Type C"]')
        .locator('.__content')
        .locator('.__interfaces');
    await newOutputInterface.click({ button: 'right' });
    const contextMenuOption = page.locator('.baklava-context-menu').getByText('Expose Interface');
    await contextMenuOption.click();
    await leaveSubgraph(page);

    expect(await nodeA.locator('.__interfaces').locator('[id]').count()).toBe(2);

    // B inherits from A
    const nodeB = page.locator('[data-node-type="Type B"]');
    expect(await nodeB.locator('.__interfaces').locator('[id]').count()).toBe(3);
});
