import { test, expect, Page, Locator } from '@playwright/test';
import { getUrl, getPathToJsonFile, addNode, openFileChooser } from './config.js';

import os from 'os';
import fs from 'fs/promises';

const temporaryDir = os.tmpdir() + '/';

async function enableEditingNodes(page: Page) {
    // Assert that node types cannot be added
    const logo = await page.locator('.logo');
    await logo.hover();
    let addNodeButton = await logo.locator('#create-new-node-type-button');
    expect(addNodeButton).toBeHidden();

    // Enable modifying node types
    const settings = await page.locator('.settings-panel');
    expect(settings).toBeVisible();

    const checkbox = await settings
        .locator('.baklava-checkbox')
        .nth(1)
        .locator('.__checkmark-container');
    expect(checkbox).toBeVisible();
    await checkbox.click();

    // Assert that node types can be added
    await logo.hover();
    addNodeButton = await logo.locator('#create-new-node-type-button');
    expect(addNodeButton).toBeVisible();
}

async function createNewNodeType(page: Page) {
    // Open node configuration menu
    const logo = await page.locator('.logo');
    await logo.hover();
    const addNodeButton = await logo.locator('#create-new-node-type-button');
    await addNodeButton.click();

    // Create node
    const nodeMenu = await page.locator('#container').locator('.create-menu');
    const createButton = await nodeMenu.getByText('Create');
    await createButton.click();
}

async function loadIncludeSpecification(page: Page) {
    const fileChooser = await openFileChooser(page, 'specification');
    await fileChooser.setFiles(getPathToJsonFile('sample-include-specification.json'));
}

async function addInterface(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last();
    await node.click({ button: 'right', force: true });
    await page.getByText('Add interface').click();
    await page.getByRole('button', { name: 'Add interface' }).click();

    const inputs = await page
        .locator('[data-node-type="Custom Node"]')
        .locator('.__interfaces .__inputs > div')
        .count();
    expect(inputs).toBe(1);
}

async function saveSpecificationAs(page: Page, filenameWithoutExtension: string): Promise<string> {
    const logo = page.locator('.logo');
    await logo.hover();
    const saveAsMenuOption = page.getByRole('button', { name: 'Save specification as...' });
    await saveAsMenuOption.click();

    await page.getByPlaceholder('File name').fill(filenameWithoutExtension);
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
    await enableEditingNodes(page);
});

test('create new node type', async ({ page }) => {
    await page.goto(getUrl());
    await enableEditingNodes(page);
    await createNewNodeType(page);
    await addNode(page, 'Default category', 'Custom Node', 750, 80);
});

test('add interface to custom node in specification with "include" keyword', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);
    await enableEditingNodes(page);

    const nodeName = 'Custom Node';
    await createNewNodeType(page);
    await addNode(page, 'Default category', nodeName, 750, 80);
    await addInterface(page, nodeName);
});

test('register custom node in specification with "include" keyword', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);
    await enableEditingNodes(page);

    const nodeName = 'Custom Node';
    await createNewNodeType(page);
    await addNode(page, 'Default category', nodeName, 750, 80);
    const specificationPath = await saveSpecificationAs(page, 'new_specification');
    await verifyNodePresence(page, specificationPath, nodeName);
});
