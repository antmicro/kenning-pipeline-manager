import { test, expect, Page, FileChooser } from '@playwright/test';
import { setTimeout } from "timers/promises";
import { getPathToJsonFile, getUrl, addNode, dragAndDrop, enableEditingNodes, loadSpecification, loadDataflow } from './config.js';
import YAML from 'yaml';

async function assertInputCount(page: Page, nodeName: string, count: integer) {
    const inputs = await page
        .locator(`[data-node-type="${nodeName}"]`)
        .locator('.__interfaces .__inputs > div')
        .count();
    expect(inputs).toBe(count);
}
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
async function getYAMLEditorContent(page: Page) {
    const textarea = page.locator('textarea');
    const value = await textarea.evaluate((el) => el.value);
    return value;
}
async function addInterface(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last();
    await node.click({ button: 'right', force: true });
    await page.getByText('Add interface').click();
    await page.getByRole('button', { name: 'Add interface' }).click();

    await assertInputCount(page, nodeName, 2);
}
async function addProperty(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last();
    await node.click({ button: 'right', force: true });
    await page.getByText('Add property').click();
    await page.getByRole('button', { name: 'Add property' }).click();
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

test('adding interface from UI reflected in YAML editor', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-subgraph-specification.json');
    await loadDataflow(page, 'sample-subgraph-dataflow.json');

    await enableEditingNodes(page);

    // Insatiate a new node.
    const nodeName = 'Custom Node';
    await openNodePalette(page);
    await createNewNodeType(page);
    await addNode(page, 'Default category', nodeName, 750, 80);

    // Double click the node to open the YAML editor.
    const customNode = page.locator('[data-node-type="Custom Node"]').first();
    await customNode.dblclick({ force: true });

    // Retrieve the initial content of the YAML editor.
    const initialContent = await getYAMLEditorContent(page);
    const parsedContent = YAML.parse(initialContent);

    // Retrieve the modified content of the YAML editor.
    await addInterface(page, nodeName);
    const modifiedContent = await getYAMLEditorContent(page);

    // Count the number of elements in the `interfaces` attribute.
    const initialInterfacesCount = parsedContent.interfaces.length;
    const modifiedParsedContent = YAML.parse(modifiedContent);
    const modifiedInterfacesCount = modifiedParsedContent.interfaces.length;

    expect(initialInterfacesCount).toBe(0);
    expect(modifiedInterfacesCount).toBe(1);
});
test('checking inherited properties', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-inheritance-specification.json');
    await loadDataflow(page, 'sample-inheritance-dataflow.json');

    await enableEditingNodes(page);

    const node = page
        .locator('div')
        .filter({ hasText: /^Type B$/ })
        .nth(3);
    await node.dblclick();

    const initialContent = await getYAMLEditorContent(page);
    const parsedContent = YAML.parse(initialContent);
    expect(parsedContent.properties.length).toBe(1);

    await addProperty(page, 'Type B');

    const modifiedContent = await getYAMLEditorContent(page);
    const modifiedParsedContent = YAML.parse(modifiedContent);
    expect(modifiedParsedContent.properties.length).toBe(2);
});
