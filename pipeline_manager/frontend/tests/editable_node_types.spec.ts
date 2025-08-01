import { test, expect, Page, Locator } from '@playwright/test';
import { getUrl, getPathToJsonFile, addNode, openFileChooser, dragAndDrop, enableNavigationBar } from './config.js';

import os from 'os';
import fs from 'fs/promises';

const temporaryDir = os.tmpdir() + '/';


async function enableEditingNodes(page: Page) {
    // Open a setting panel.
    const logo = page.locator('.logo');
    await logo.hover();

    // Enable modifying node types.
    const settings = page.locator('.settings-panel');
    await settings.hover();
    expect(settings).toBeVisible();

    // Only click the checkbox if it is not already checked.
    const checkbox = page.getByTitle('Modify node types');
    const isChecked = await checkbox.evaluate((el) =>
        el.classList.contains('--checked')
    );
    if (!isChecked) {
        await checkbox.click();
    }
    await expect(checkbox).toBeVisible();

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
    expect(inputs).toBe(2);
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
    await enableEditingNodes(page);
});

test('create new node type', async ({ page }) => {
    await page.goto(getUrl());
    await loadIncludeSpecification(page);

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
