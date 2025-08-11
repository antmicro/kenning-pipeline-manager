import YAML from 'yaml';
import {
    test, expect, Page, FileChooser,
} from '@playwright/test';
import {
    getPathToJsonFile, getUrl, addNode, dragAndDrop, enableEditingNodes,
    loadSpecification, loadDataflow, openNodePalette,
} from './config.js';

async function assertInputCount(page: Page, nodeName: string, count: number) {
    const inputs = await page
        .locator(`[data-node-type="${nodeName}"]`)
        .locator('.__interfaces .__inputs > div')
        .count();
    expect(inputs).toBe(count);
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
    const node = page
        .locator(`.baklava-node[data-node-type="${nodeName}"]`)
        .first();
    await node.locator('.__title').click({ button: 'right', force: true });
    await node.locator('.baklava-context-menu').getByText('Add interface').click();
    await page.getByRole('button', { name: 'Add interface' }).click();

    await assertInputCount(page, nodeName, 2);
}

async function checkIfYAMLPersists(page: Page) {
    // Open a pop-up for the first node.
    const node = page
        .locator(`.baklava-node[data-node-type="Test node #1"] .__title`)
        .first();
    await node.dblclick();

    // Type a new text to the YAML editor.
    const newValue = 'ABC';
    const textarea = page.locator('textarea');
    await textarea.fill(newValue);

    // Switch to a different node.
    await page
        .locator(`.baklava-node[data-node-type="Test node #2"] .__title`)
        .first()
        .dblclick();

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
    await addNode(page, 'Default category', nodeName, 500, 80);

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
test('adding interface to YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-include-specification.json');
    await addNode(page, 'Filesystem', 'LoadVideo', 750, 80);
});
test('adding property to YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-include-specification.json');
});
test('rename node type', async ({ page }) => {
    await page.goto(getUrl());

    await loadSpecification(page, 'sample-include-specification.json');

    await addNode(page, 'Filesystem', 'LoadVideo', 750, 80);
    const node = page.getByText('LoadVideo').locator('..').last();
    await node.dblclick();

    const textarea = page.locator('textarea');
    const nodeSpecification = await textarea.inputValue();
    const newSpecification = nodeSpecification.replace('LoadVideo', 'New node name');

    await textarea.fill(newSpecification);
    await page.getByText('Apply', { exact: true }).click();

    // assert that both nodes are renamed
    const editedNode = page.locator('[data-node-type="New node name"]');
    expect(await editedNode.count()).toBe(2);

    // assert that the node is renamed in node palette
    const nodePalette = page.locator('.baklava-node-palette');
    const category = nodePalette.getByText('Filesystem');

    await openNodePalette(page);
    await category.scrollIntoViewIfNeeded();
    await expect(category).toBeVisible();

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
