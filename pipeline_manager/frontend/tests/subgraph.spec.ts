import { test, expect, Page, Locator } from '@playwright/test';
import {
    waitForNodeSubgraph,disableNavigationBar,addSubgraph,dragAndDrop,
    loadSpecification,loadDataflow,verifyNodeCount,getPathToJsonFile,checkForSubgraph,
    waitForSubgraph,getYAML,deleteProperty,addProperty,addInterface,enterSubgraph,
    leaveSubgraph,getNode,deleteNode, getUrl, openFileChooser, enableEditingNodes,
    enableNavigationBar, addNode, getContextMenu, AddConnection,
    assertPropertyCount,
} from './config.js';

import os from 'os';
import fs from 'fs/promises';
import path from 'path';

const countOfInitiallyExposedInterface = 3;

const countOfInitiallyExposedProperties = 1;

const temporaryDir = os.tmpdir() + '/';

async function prepareSubgraphPage(page: Page) {
    await page.goto(getUrl());
    await loadSpecification(page,'sample-subgraph-specification.json');
    await loadDataflow(page,'sample-subgraph-dataflow.json');
    await verifyNodeCount(page, 5);
}

test('test loading subgraph dataflow', async ({ page }) => {
    await prepareSubgraphPage(page);
});

test('test entering subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enterSubgraph(getNode(page, 'Test subgraph #1'), page);
    await waitForSubgraph(page, 'Test subgraph #1');
    await verifyNodeCount(page, 2);
});

test('test coming back from subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);

    await enterSubgraph(getNode(page, 'Test subgraph #1'), page);
    await waitForSubgraph(page, 'Test subgraph #1');
    await verifyNodeCount(page, 2);

    await leaveSubgraph(page);
    await verifyNodeCount(page, 5);
});

async function placeNewNode(page: Page, location: { x: number; y: number }) {
    await enableNavigationBar(page);
    const firstCategoryLabel = page.getByText('First Category');
    await firstCategoryLabel.click();
    const nodeFromBrowser = page.getByText('Test node #1').first();
    await dragAndDrop(page, nodeFromBrowser, location.x, location.y);
    await disableNavigationBar(page);
}

async function createNewNode(page: Page, location: { x: number; y: number },nodeName: string = "Custom Node") {
    await enableNavigationBar(page);
    const newNodeType = page.getByText('New Node Type').first();
    await dragAndDrop(page, newNodeType, location.x, location.y);
    const nodeNameInput = page.getByTitle('Node name');
    await nodeNameInput.fill(nodeName);
    const createButton = page.getByText('Create').first();
    await createButton.click();
}

async function createNewGraphNode(page: Page, location: { x: number; y: number }) {
    await enableNavigationBar(page);
    await createNewNode(page,location,'New Graph Node');
    const newGraphNodeType = getNode(page,'New Graph Node').first();
    await addSubgraph(newGraphNodeType,page);
}

test('test preserving changes to subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);

    const subgraphNode = getNode(page, 'Test subgraph #1');
    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #1');
    await verifyNodeCount(page, 2);
    await placeNewNode(page, { x: 400, y: 200 });

    await verifyNodeCount(page, 3);

    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');
    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #1');
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

test('test disable expose interfaces metadata option',async ({page}) => {
    await page.goto(getUrl());

    const node = getNode(page,'LoadVideo');
    const interfacePort = node.locator('.__interfaces .__outputs .__port').first();
    await interfacePort.click({button: 'right'});

    await expect(page.getByText('Expose interface')).toBeVisible();

    // Load specification with disabled expose interface option
    const specification = {
        "version": "20250623.14",
        "include": [
            {
                "url": "https://raw.githubusercontent.com/antmicro/kenning-pipeline-manager/main/examples/sample-specification.json"
            }
        ],
        "nodes": [],
        "metadata": {
            "disableInterfaceExpose": true
        }
    }
    const outputPath = path.join(temporaryDir, 'modified-specification.json');
    await fs.writeFile(outputPath, JSON.stringify(specification, null, 2), 'utf-8');

    const fileChooserSpec = await openFileChooser(page, 'specification');
    await fileChooserSpec.setFiles(outputPath);

    await loadDataflow(page, 'sample-dataflow.json');

    await interfacePort.click({button: 'right'});
    await expect(page.getByText('Expose interface')).not.toBeVisible();
});

test('test visibility of newly exposed subgraph interface', async ({ page }) => {
    await prepareSubgraphPage(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    const exposedInterfaces =
        await verifyInterfaceCount(countOfInitiallyExposedInterface, subgraphNode);

    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #1');
    await placeNewNode(page, { x: 400, y: 200 });

    // Expose a new interface: right click on an interface and choose 'Expose Interface'.
    const node = getNode(page, 'Test node #1').last();
    const newOutputInterface = node
        .locator('.__content .__outputs .__port')
        .nth(1);
    await newOutputInterface.click({ button: 'right' });
    const menu = getContextMenu(page);
    const contextMenuOption = menu.getByText('Expose Interface');
    await contextMenuOption.click();

    // Get back to the main graph.
    await leaveSubgraph(page);

    // Check if the newly exposed interface is present.
    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface + 1);
});

test('test hiding and exposing subgraphs interface', async ({ page }) => {
    await prepareSubgraphPage(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    const exposedInterfaces =
        await verifyInterfaceCount(countOfInitiallyExposedInterface, subgraphNode);

    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #1');

    // Hide an exposed interface: invoke a interface's context menu and click the option.
    const targetNode = getNode(page, 'Test node #1').nth(1);
    const exposedInterface = targetNode
        .locator('.__content .__port')
        .nth(1);
    await exposedInterface.click({ button: 'right' });

    const privatizeContextMenuOption = getContextMenu(page).getByText('Privatize Interface');
    await privatizeContextMenuOption.click();

    // Get back to the main graph.
    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');
    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface - 1);

    // Re-expose the currently hidden interface:
    // invoke an interface's context menu and click the option.
    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #1');
    await exposedInterface.click({ button: 'right' });
    const exposeContextMenuOption = getContextMenu(page).getByText('Expose Interface');
    await exposeContextMenuOption.click();

    // Get back to the main graph.
    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');
    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface);
});

test('test renaming exposed interface', async ({ page }) => {
    await prepareSubgraphPage(page);

    const subgraphNode = getNode(page, 'Test subgraph #1');
    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #1');
    await verifyNodeCount(page, 2);

    // Rename an exposed interface.
    const newName = 'previously_nonexistent_interface';
    await page.locator('.__port').nth(2).hover();
    await page.getByText('Subgraph Input').click();
    await page.getByPlaceholder('External name').fill(newName);
    await page.getByPlaceholder('External name').press('Enter');

    // Verify if the exposed interface's name has been changed.
    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');
    await verifyNodeCount(page, 5);
    await expect(page.locator('#container')).toContainText(newName);
});

test('modifying subgraph interfaces correctly reflected in yaml editor', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    await addInterface(page, subgraphNode);
    const content = await getYAML(page, subgraphNode);
    expect(await content.interfaces.length).toBe(2);
});

test('modifying subgraph properties correctly reflected in yaml editor', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    await addProperty(page, subgraphNode);
    const content = await getYAML(page, subgraphNode);
    expect(await content.properties.length).toBe(2);
});

test('test adding exposed property', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #1');
    const node = getNode(page, 'Test node #1').first();
    await addProperty(page, node);

    const exposedProperty = node
        .getByText('New property');
    await exposedProperty.click({ button: 'right' });
    const privatizeContextMenuOption = getContextMenu(page).getByText('Expose Property');
    await privatizeContextMenuOption.click();

    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');
    await expect(page.locator('#container')).toContainText('New property');
    await verifyPropertyCount(subgraphNode, 2);

    await deleteProperty(page, subgraphNode, 'Sample option');

    // check if YAML specification is correctly saved
    const content = await getYAML(page, subgraphNode);
    expect(await content.properties.find((entry) => entry.name === 'New property')).toBe(undefined);
    expect(await content.properties.length).toBe(0);
});

test('test hiding and exposing subgraphs property', async ({ page }) => {
    await prepareSubgraphPage(page);
    const subgraphNode = getNode(page, 'Test subgraph #2');
    const propertyCount =
        await verifyPropertyCount(subgraphNode, countOfInitiallyExposedProperties);
    await enableEditingNodes(page);
    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #2');

    const targetNode = getNode(page, 'Test node #2');
    const exposedProperty = targetNode
        .locator('.__content .__properties')
        .last();

    await exposedProperty.click({ button: 'right', force: true });
    const privatizeContextMenuOption = getContextMenu(page).getByText('Privatize Property');
    await privatizeContextMenuOption.click();

    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');
    expect(await propertyCount.count()).toBe(countOfInitiallyExposedProperties - 1);

    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #2');

    await exposedProperty.click({ button: 'right', force: true });
    const exposeContextMenuOption = getContextMenu(page).getByText('Expose Property');
    await exposeContextMenuOption.click();

    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');
    expect(await propertyCount.count()).toBe(countOfInitiallyExposedProperties);
});

test('test add subgraph', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);

    const node = getNode(page, 'Test node #1');
    await addSubgraph(node, page);
    await waitForNodeSubgraph(node);
    await checkForSubgraph(node, page);
});

test('test add subgraph, with sub-node', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test node #2');
    const exposedInterfaces = await verifyInterfaceCount(1, subgraphNode);

    await addSubgraph(subgraphNode, page);
    await waitForNodeSubgraph(subgraphNode);
    await checkForSubgraph(subgraphNode, page);
    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test node #2');

    // check if a new node was added to new subgraph
    await verifyNodeCount(page, 0);
    await placeNewNode(page, { x: 400, y: 200 });
    await verifyNodeCount(page, 1);

    // Expose a new interface: right click on an interface and choose 'Expose Interface'.
    const node = getNode(page, 'Test node #1');
    await node.locator('.__interfaces .__outputs > div')
        .last()
        .click({ button: 'right' });

    const contextMenuOption = getContextMenu(page).getByText('Expose Interface');
    await contextMenuOption.click();

    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');

    // Check if the newly exposed interface is present.
    expect(await exposedInterfaces.count()).toBe(2);
});

test('test remove node with exposed interface', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    const exposedInterfaces =
        await verifyInterfaceCount(countOfInitiallyExposedInterface, subgraphNode);

    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #1');

    // check if a node has been removed from subgraph
    await verifyNodeCount(page, 2);
    const nodeToRemove = getNode(page, 'Test node #1').nth(1);
    await deleteNode(nodeToRemove, page);
    await verifyNodeCount(page, 1);

    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');

    expect(await exposedInterfaces.count()).toBe(countOfInitiallyExposedInterface - 2);
});

test('test remove node with exposed properties', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #2');
    const exposedProperties = await verifyPropertyCount(subgraphNode, 1);

    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #2');

    // check if a node has been removed from subgraph
    await verifyNodeCount(page, 5);
    await deleteNode(getNode(page, 'Test node #2'), page);
    await verifyNodeCount(page, 4);

    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');

    expect(await exposedProperties.count()).toBe(0);
});

test('test new node type creation', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);

    await createNewNode(page, { x: 400, y: 400 });

    // check if a new node type has been added
    await verifyNodeCount(page, 6);
});

test('test new graph node creation', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);

    await createNewGraphNode(page, { x: 400, y: 400 });

    // check if a new node type has been added
    await verifyNodeCount(page, 6);

    // enter into a new graph node
    const subgraphNode = getNode(page, 'New Graph Node');
    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'New Graph Node');

    // add a node
    await verifyNodeCount(page, 0);
    await placeNewNode(page, { x: 400, y: 400 });
    await verifyNodeCount(page, 1);

    // expose a interface
    const newOutputInterface = getNode(page, 'Test node #1')
        .locator('.__content .__outputs .__port')
        .first();
    await newOutputInterface.click({ button: 'right' });

    const contextMenuOption = getContextMenu(page).getByText('Expose Interface');
    await contextMenuOption.click();

    await leaveSubgraph(page);
    await waitForSubgraph(page, 'Graph with nested subgraphs');

    await verifyInterfaceCount(1, subgraphNode);
});
test('test changing node interfaces from upper level', async ({ page }) => {
    await prepareSubgraphPage(page);
    await enableEditingNodes(page);
    const subgraphNode = getNode(page, 'Test subgraph #1');
    await verifyInterfaceCount(3, subgraphNode);
    const testNode = getNode(page, 'Test node #1').first();
    await testNode.locator('.__title').click({ button: 'right' });
    await getContextMenu(page).getByText('Delete interface').click();
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
    await getContextMenu(page).getByText('Delete property').click();
    await page.locator('.baklava-checkbox').getByText('Sample option').click();
    await page.getByRole('button', { name: 'Remove properties' }).click();
    await verifyPropertyCount(subgraphNode, 0);
});
test('test inherited subgraph from specification', async ({ page }) => {
    await prepareSubgraphPage(page);

    const parentIntfs = await getNode(page, 'Test subgraph #2').locator('.__interfaces').locator('[id]').count();
    const parentProps = await getNode(page, 'Test subgraph #2').locator('.__properties').locator('[id]').count();

    const specificationPath = getPathToJsonFile('sample-subgraph-specification.json');
    const raw = await fs.readFile(specificationPath, 'utf-8');
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
    await fs.writeFile(outputPath, JSON.stringify(json, null, 2), 'utf-8');

    // load the specification with inherited subgraph
    const fileChooserSpec = await openFileChooser(page, 'specification');
    await fileChooserSpec.setFiles(outputPath);
    await enableEditingNodes(page);
    await addNode(page, 'Test', 'InheritedSubgraph', 400, 160);
    const nodeAfterLoad = getNode(page, 'InheritedSubgraph');
    // expect number of interfaces that subgraph #1 has
    expect(await nodeAfterLoad.locator('.__interfaces').locator('[id]').count()).toBe(parentIntfs);
    expect(await nodeAfterLoad.locator('.__properties').locator('[id]').count()).toBe(parentProps + 1);
    await enterSubgraph(getNode(page, 'InheritedSubgraph'), page);
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
    const contextMenuOption = getContextMenu(page).getByText('Expose Interface');
    await contextMenuOption.click();
    await leaveSubgraph(page);

    expect(await nodeA.locator('.__interfaces').locator('[id]').count()).toBe(2);

    // B inherits from A
    const nodeB = page.locator('[data-node-type="Type B"]');
    expect(await nodeB.locator('.__interfaces').locator('[id]').count()).toBe(3);
});
test('test exposing bus type interface', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-bus-specification.json');
    // await loadDataflow(page, 'sample-bus-dataflow.json');
    await enableEditingNodes(page);
    await createNewNode(page, { x: 400, y: 400 });
    const subgraphNode = getNode(page, 'Custom Node');
    await subgraphNode.click({ button: 'right' });
    await getContextMenu(page).getByText('Add and edit subgraph').click();
    // adding node with bus and exposing that bus
    await addNode(page, 'Components', 'Motherboard', 400, 400);
    const node = getNode(page, 'Motherboard');
    await node.getByText('control-bus').click({ button: 'right' });
    await getContextMenu(page).getByText('Expose Interface').click();
    await leaveSubgraph(page);

    expect(subgraphNode.getByText('control-bus')).toBeVisible();
    expect(subgraphNode.locator('.__big-bus')).toBeVisible();

    // exposing small bus (2nd one)
    await enterSubgraph(subgraphNode, page);
    await node.getByText('address-bus').click({ button: 'right' });
    await getContextMenu(page).getByText('Expose Interface').click();
    await leaveSubgraph(page);

    expect(subgraphNode.getByText('address-bus')).toBeVisible();
    expect(await subgraphNode.locator('.__port-bus').count()).toBe(2);

    await enterSubgraph(subgraphNode, page);
    await node.getByText('control-bus').click({ button: 'right' });
    await getContextMenu(page).getByText('Privatize Interface').click();
    await node.getByText('address-bus').click({ button: 'right' });
    await getContextMenu(page).getByText('Privatize Interface').click();
    await leaveSubgraph(page);

    expect(await subgraphNode.locator('.__port').count()).toBe(0);
});

function interfacePort(page: Page, nodeName: string, interfaceName: string): Locator {
    return getNode(page, nodeName)
        .locator('.baklava-node-interface')
        .filter({ has: page.locator('.__port-name').getByText(interfaceName, { exact: true }) })
        .locator('.__port');
}

test('test connecting to an inout interface of a graph node with its graph in the dataflow', async ({ page }) => {
    // The dataflow is built dynamically from sample-subgraph-dataflow.json:
    // the subgraph definition of the "Test subgraph #1" node type (from
    // sample-subgraph-specification.json) is embedded in the dataflow and the
    // graph node is pointed at it with its `subgraph` field.
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-subgraph-specification.json');

    const specification = JSON.parse(
        await fs.readFile(getPathToJsonFile('sample-subgraph-specification.json'), 'utf-8'),
    );
    const dataflow = JSON.parse(
        await fs.readFile(getPathToJsonFile('sample-subgraph-dataflow.json'), 'utf-8'),
    );

    const graphNode = dataflow.graphs[0].nodes.find((n) => n.name === 'Test subgraph #1');
    const nodeSpecification = specification.nodes.find((n) => n.name === 'Test subgraph #1');
    const subgraph = JSON.parse(JSON.stringify(
        specification.graphs.find((g) => g.id === nodeSpecification.subgraphId),
    ));

    const exposedInterfaceIds = new Map();
    subgraph.nodes.forEach((n) => n.interfaces.forEach((intf) => {
        if (intf.externalName !== undefined) {
            exposedInterfaceIds.set(intf.externalName, intf.id);
        }
    }));
    graphNode.interfaces.forEach((intf) => {
        if (exposedInterfaceIds.has(intf.name)) {
            const oldId = intf.id;
            intf.id = exposedInterfaceIds.get(intf.name);
            const source = dataflow.graphs[0].connections.find((conn) => conn.from === oldId);
            if (source) source.from = intf.id;
            const target = dataflow.graphs[0].connections.find((conn) => conn.to === oldId);
            if (target) target.to = intf.id;
        }
    });

    dataflow.graphs.push(subgraph);
    graphNode.subgraph = subgraph.id;

    const outputPath = path.join(temporaryDir, 'sample-subgraph-embedded-dataflow.json');
    await fs.writeFile(outputPath, JSON.stringify(dataflow, null, 2), 'utf-8');

    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(outputPath);
    await verifyNodeCount(page, 5);

    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(3);
    await AddConnection(
        page,
        interfacePort(page, 'Test node #1', 'Output'),
        interfacePort(page, 'Test subgraph #1', 'Subgraph Inout 1'),
    );
    await expect(connections, {
        message: 'Connecting to an inout interface of a graph node failed.',
    }).toHaveCount(4);
});

async function toggleShowHiddenProperties(page: Page) {
    const checkbox = page.getByText('Show hidden properties', { exact: true });
    expect(checkbox).toBeVisible();
    await checkbox.dispatchEvent('click');
}

test('test exposed hidden property keeps hidden attribute', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-subgraph-specification.json');

    await addNode(page, 'Second Category', 'Test subgraph #2', 400, 400);
    const subgraphNode = getNode(page, 'Test subgraph #2');

    await assertPropertyCount(subgraphNode, 1);

    await enterSubgraph(subgraphNode, page);
    await waitForSubgraph(page, 'Test subgraph #2');

    const property = getNode(page, 'Test node #2').locator('.__properties .__label');

    // Hide the property, then privatize and expose it again. The exposed
    // property on the graph node has to keep the hidden attribute.
    await property.click({ button: 'right' });
    await getContextMenu(page).getByText('Hide', { exact: true }).click();

    // The hidden property is not rendered, so it has to be shown to interact with it.
    await toggleShowHiddenProperties(page);

    await property.click({ button: 'right' });
    await getContextMenu(page).getByText('Privatize Property', { exact: true }).click();

    await property.click({ button: 'right' });
    await getContextMenu(page).getByText('Expose Property', { exact: true }).click();

    await leaveSubgraph(page);
    await expect(subgraphNode).toBeVisible();

    // The exposed property exists on the graph node but it's hidden.
    await assertPropertyCount(subgraphNode, 1);
    await toggleShowHiddenProperties(page);
    await assertPropertyCount(subgraphNode, 0);
});
