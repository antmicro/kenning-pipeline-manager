import { test, expect, Page, FileChooser } from '@playwright/test';
import { getPathToJsonFile, getUrl } from './config.js';

async function enableEditingNodes(page: Page) {
    // Assert that node types cannot be added.
    const logo = page.locator('.logo');
    await logo.hover();
    let addNodeButton = logo.locator('#create-new-node-type-button');
    expect(addNodeButton).toBeHidden();

    // Enable modifying node types.
    const settings = page.locator('.settings-panel');
    expect(settings).toBeVisible();
    await settings.hover();

    const checkbox = page.getByText('Modify node types');
    expect(checkbox).toBeVisible();
    await checkbox.click();
}

async function openFileChooser(
    page: Page,
    purpose: 'specification' | 'dataflow',
): Promise<FileChooser> {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.mouse.move(25, 25);
    const text = purpose === 'specification' ? 'Load specification' : 'Load graph file';
    await page.getByText(text).click();
    return await fileChooserPromise;
}

async function loadSpecification(page: Page, specificationFile: string) {
    const fileChooser = await openFileChooser(page, 'specification');
    await fileChooser.setFiles(getPathToJsonFile(specificationFile));
}

async function loadDataflow(page: Page, dataflowFile: string) {
    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(getPathToJsonFile(dataflowFile));
}

async function checkIfYAMLPersists(page: Page) {
    // Open a pop-up for the first node.
    const node = page
        .locator('div')
        .filter({ hasText: /^Test node #1$/ })
        .nth(3);
    await node.dblclick();

    // Type a new text to the YAML editor.
    const newValue = 'ABC';
    const textarea = page.locator('textarea');
    await textarea.fill(newValue);

    // Switch to a different node.
    const anotherNode = page
        .locator('div')
        .filter({ hasText: /^Test node #2$/ })
        .nth(3);
    await anotherNode.dblclick();

    // Get back and verify if the new value persists.
    await node.dblclick();
    await expect(textarea).toHaveValue(newValue);
}

test('create new node type', async ({ page }) => {
    await page.goto(getUrl());

    await loadSpecification(page, 'sample-subgraph-specification.json');
    await loadDataflow(page, 'sample-subgraph-dataflow.json');

    await enableEditingNodes(page);
    await checkIfYAMLPersists(page);
});
