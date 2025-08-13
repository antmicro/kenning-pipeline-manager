import { test, expect, Page, Locator } from '@playwright/test';
import { getUrl, getPathToJsonFile, addNode, openFileChooser, dragAndDrop, enableNavigationBar } from './config.js';

import os from 'os';
import fs from 'fs/promises';

const temporaryDir = os.tmpdir() + '/';


async function openNodePalette(page: Page) {
    // Assert that node types can be added.
    await page.locator('div').filter({ hasText: /^Show node browser$/ }).first().click();
    const nodePalette = page.locator('.baklava-node-palette');
    const addNodeButton = nodePalette.getByText('New Node Type').first();
    expect(addNodeButton).toBeVisible();
}

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

async function loadIncludeSpecification(page: Page) {
    const fileChooser = await openFileChooser(page, 'specification');
    const specificationName = 'sample-include-specification.json';
    const specification = await fs.readFile(getPathToJsonFile(specificationName), { encoding: 'utf-8' });
    const newSpecification = specification.replaceAll(
        'https://raw.githubusercontent.com/antmicro/kenning-pipeline-manager/main/examples/',
        `http://localhost:7001/`,
    );
    const newSpecificationPath = temporaryDir + specificationName;
    await fs.writeFile(newSpecificationPath, newSpecification);
    await fileChooser.setFiles(newSpecificationPath);
}

async function assertInputCount(page: Page, nodeName: string, count: integer) {
    const inputs = await page
        .locator(`[data-node-type="${nodeName}"]`)
        .locator('.__interfaces .__inputs > div')
        .count();
    expect(inputs).toBe(count);
}

async function addInterface(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last();
    await node.click({ button: 'right', force: true });
    await page.getByText('Add interface').click();
    await page.getByRole('button', { name: 'Add interface' }).click();

    await assertInputCount(page, nodeName, 2);
}

async function renameNodeType(page: Page, oldName: string, newName: string) {
    const node = page.getByText(oldName).last();
    await node.click({ button: 'right', force: true });
    await page.getByText('Configure').click();
    await page.getByRole('textbox').first().fill(newName);
    await page.getByRole('button', { name: 'Configure' }).click();
}

async function addParentAndChildNode(page: Page, coord: integer) {
    await addNode(page, 'Processing', 'Binary images', 750, 80);

    await openNodePalette(page);
    const nodePalette = page.locator('.baklava-node-palette');
    const category = nodePalette.getByText('Processing', { exact: true });
    await category.scrollIntoViewIfNeeded();
    await expect(category).toBeVisible();

    const categoryNodeEntry = nodePalette.getByText('Binary images');
    const categoryNodeButton = categoryNodeEntry.locator('../..').locator('svg.arrow.right.small');
    await categoryNodeButton.scrollIntoViewIfNeeded();
    await expect(categoryNodeButton).toBeVisible();
    await categoryNodeButton.click();

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
    console.log(specification);

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

test('enable editing', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);
    await openNodePalette(page);
});

test('create new node type', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);

    await openNodePalette(page);
    await createNewNodeType(page);
    await addNode(page, 'Default category', 'Custom Node', 750, 80);
});

test('add interface to custom node in specification with "include" keyword', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);
    await openNodePalette(page);

    const nodeName = 'Custom Node';
    await createNewNodeType(page);
    await addNode(page, 'Default category', nodeName, 750, 80);
    await addInterface(page, nodeName);
});

test('register custom node in specification with "include" keyword', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);
    await openNodePalette(page);

    const nodeName = 'Custom Node';
    await createNewNodeType(page);
    await addNode(page, 'Default category', nodeName, 750, 80);
    const specificationPath = await saveSpecificationAs(page, 'new_specification');
    await verifyNodePresence(page, specificationPath, nodeName);
});

test('rename extending node', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);

    await addNode(page, 'Filesystem', 'LoadVideo', 750, 80);
    await openNodePalette(page);
    await renameNodeType(page, 'LoadVideo', 'New node name');

    // assert that both nodes are renamed
    const editedNode = page.locator('[data-node-type="New node name"]');
    expect(await editedNode.count()).toBe(2);

    // assert that the node is renamed in node palette
    const nodePalette = page.locator('.baklava-node-palette');
    const category = nodePalette.getByText('Filesystem');

    await openNodePalette(page);
    await category.scrollIntoViewIfNeeded();
    await expect(category).toBeVisible();
    await category.click();

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

test('rename category node', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);

    await addParentAndChildNode(page, 200);
    await openNodePalette(page);

    await renameNodeType(page, 'Binary images', 'New node name');
    await assertInputCount(page, 'Logical AND', 2);

    // check category in custom sidebar
    const node = page.getByText('Logical AND').locator('..').last();
    await node.click({ button: 'right'});
    await page.getByText('Details').click();

    const parents = page.getByText('Generalize');
    const siblings = page.getByText('Choose other type');
    await expect(parents).toBeVisible();
    await expect(siblings).toBeVisible();
});

test('add interface to category node', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);

    await addParentAndChildNode(page, 200);
    await openNodePalette(page);

    await addInterface(page, 'Binary images');
    await assertInputCount(page, 'Logical AND', 3);

    await addParentAndChildNode(page, 200);
    await assertInputCount(page, 'Binary images', 4);
    await assertInputCount(page, 'Logical AND', 6);
});
