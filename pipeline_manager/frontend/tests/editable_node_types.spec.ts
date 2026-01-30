import {
    test, expect, Page, TestInfo,
} from '@playwright/test';

import os from 'os';
import fs from 'fs/promises';

import {
    getUrl, getPathToJsonFile, addNode, openFileChooser, dragAndDrop, openNodePalette,
} from './config.js';

const temporaryDir = `${os.tmpdir()}/`;

async function createNewNodeType(page: Page) {
    // Open node configuration menu
    const nodePalette = page.locator('.baklava-node-palette');
    const addNodeButton = nodePalette.getByText('New Node Type').first();
    await dragAndDrop(page, addNodeButton, 750, 80);

    // Create node
    const nodeMenu = page.locator('#container').locator('.create-menu');
    const createButton = nodeMenu.getByText('Create');
    await createButton.click();
}

async function loadIncludeSpecification(page: Page, testInfo: TestInfo) {
    const fileChooser = await openFileChooser(page, 'specification');
    const specificationName = 'sample-include-specification.json';
    const specification = await fs.readFile(
        getPathToJsonFile(specificationName),
        { encoding: 'utf-8' },
    );
    const newSpecification = specification.replaceAll(
        'https://raw.githubusercontent.com/antmicro/kenning-pipeline-manager/main/examples/',
        `http://localhost:7001/`,
    );
    const newSpecificationPath =
        `${temporaryDir}sample-include-specification-worker-${testInfo.workerIndex}.json`;
    await fs.writeFile(newSpecificationPath, newSpecification);
    await fileChooser.setFiles(newSpecificationPath);
}

async function assertInputCount(page: Page, nodeName: string, count: number) {
    const inputs = await page
        .locator(`[data-node-type="${nodeName}"]`)
        .locator('.__interfaces .__inputs > div')
        .count();
    expect(inputs).toBe(count);
}

async function addInterface(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last();
    await node.click({ button: 'right', force: true });
    await node.locator('..').getByText('Add interface').click();
    await page.getByRole('button', { name: 'Add interface' }).click();

    await assertInputCount(page, nodeName, 2);
}

async function renameNodeType(page: Page, oldName: string, newName: string) {
    const node = page.getByText(oldName).last();
    await node.click({ button: 'right', force: true });
    await node.locator('..').getByText('Configure').click();
    await page.locator('.create-menu').getByTitle('Node name').first().fill(newName);
    await page.getByRole('button', { name: 'Configure' }).click();
}

async function addParentAndChildNode(page: Page, coord: number, openCategory = true) {
    await addNode(page, 'Processing', 'Binary images', 750, 80, openCategory);

    await openNodePalette(page);
    const nodePalette = page.locator('.baklava-node-palette');

    const categoryNodeEntry = nodePalette.getByText('Binary images');
    const orient = openCategory ? 'right' : 'left';
    const categoryNodeButton = categoryNodeEntry.locator('../..').locator(`svg.arrow.${orient}.small`);
    await categoryNodeButton.scrollIntoViewIfNeeded();
    await expect(categoryNodeButton).toBeVisible();
    if (openCategory) await categoryNodeButton.click();

    const childNodeEntry = nodePalette.getByText('Logical AND');
    await expect(childNodeEntry).toBeVisible();
    await dragAndDrop(page, childNodeEntry, 500, coord);
}

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

async function verifyNodePresence(page: Page, specificationPath: string, nodeName: string) {
    const specFile = await fs.readFile(specificationPath, 'utf-8');
    const specification = JSON.parse(specFile);

    expect(
        specification.nodes.filter(
            (node: any) =>
                node.name === nodeName &&
                Array.isArray(node.interfaces) &&
                node.interfaces.length === 0 &&
                Array.isArray(node.properties) &&
                node.properties.length === 0,
        ).length === 1,
    ).toBeTruthy();
}

test('enable editing', async ({ page }, testInfo) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page, testInfo);
    await openNodePalette(page);
});

test('create new node type', async ({ page }, testInfo) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page, testInfo);

    await openNodePalette(page);
    await createNewNodeType(page);
    await addNode(page, 'Default category', 'Custom Node', 750, 80);
});

test('add interface to custom node in specification with "include" keyword', async ({ page }, testInfo) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page, testInfo);
    await openNodePalette(page);

    const nodeName = 'Custom Node';
    await createNewNodeType(page);
    await addNode(page, 'Default category', nodeName, 750, 80);
    await addInterface(page, nodeName);
});

test('register custom node in specification with "include" keyword', async ({ page }, testInfo) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page, testInfo);
    await openNodePalette(page);

    const nodeName = 'Custom Node';
    await createNewNodeType(page);
    await addNode(page, 'Default category', nodeName, 750, 80);
    const specificationPath = await saveSpecificationAs(page, 'new_specification');
    console.log(specificationPath);
    await verifyNodePresence(page, specificationPath, nodeName);
});

test('rename extending node', async ({ page }, testInfo) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page, testInfo);

    await addNode(page, 'Filesystem', 'LoadVideo', 750, 80);
    await openNodePalette(page);
    await renameNodeType(page, 'LoadVideo', 'New node name');

    // assert that both nodes are renamed
    const editedNode = page.locator('[data-node-type="New node name"]');
    expect(await editedNode.count()).toBe(2);

    // assert that the node is renamed in node palette
    const nodePalette = page.locator('.baklava-node-palette');

    await openNodePalette(page);

    const newNodeEntry = nodePalette.getByText('New node name');
    expect(newNodeEntry).toBeVisible();
    const oldNodeEntry = nodePalette.getByText('LoadVideo', { exact: true });
    expect(oldNodeEntry).not.toBeAttached();

    // assert that both nodes have inherited properties
    expect(editedNode.first().getByText('filename')).toBeVisible();
    expect(editedNode.first().getByText('frames')).toBeVisible();
    expect(editedNode.nth(1).getByText('filename')).toBeVisible();
    expect(editedNode.nth(1).getByText('frames')).toBeVisible();

    // assert that a new node has inherited properties
    await dragAndDrop(page, newNodeEntry, 300, 300);
    expect(editedNode.nth(2).getByText('filename')).toBeVisible();
    expect(editedNode.nth(2).getByText('frames')).toBeVisible();
});

test('rename category node', async ({ page }, testInfo) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page, testInfo);

    await addParentAndChildNode(page, 200);
    await openNodePalette(page);

    await renameNodeType(page, 'Binary images', 'New node name');
    await assertInputCount(page, 'Logical AND', 2);

    // check category in custom sidebar
    const node = page.getByText('Logical AND').locator('..').last();
    await node.click({ button: 'right' });
    await node.getByText('Details', { exact: true }).click();

    const parents = page.getByText('Generalize');
    const siblings = page.getByText('Choose other type');
    await expect(parents).toBeVisible();
    await expect(siblings).toBeVisible();
});

test('add interface to category node', async ({ page }, testInfo) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page, testInfo);

    await addParentAndChildNode(page, 200);

    await addInterface(page, 'Binary images');
    await assertInputCount(page, 'Logical AND', 3);

    await addParentAndChildNode(page, 200, false);
    await assertInputCount(page, 'Binary images', 4);
    await assertInputCount(page, 'Logical AND', 6);
});

test('hiding property', async ({ page }, testInfo) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page, testInfo);

    await addNode(page, 'Generators', 'GaussianKernel', 750, 80, true);
    const node = page.locator('[data-node-type="GaussianKernel"]').first();
    const nodePropertiesBefore = node.locator('.__content > .__properties > div');

    expect(await nodePropertiesBefore.count()).toBe(3);
    const sigmaProp = page.getByText('sigma').first();
    await sigmaProp.click({ button: 'right' });
    await node.locator('.baklava-context-menu').getByText('Hide').click();
    expect(await nodePropertiesBefore.count()).toBe(2);
    const nodeTitle = node.locator('.__title');
    await nodeTitle.dblclick();
    await page.locator('.baklava-sidebar').locator('.__property-button').click();
    expect(await nodePropertiesBefore.count()).toBe(3);
});
