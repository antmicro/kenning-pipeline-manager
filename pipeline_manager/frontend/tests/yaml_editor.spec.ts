import YAML from 'yaml';
import {
    test, expect, Page,
    Locator,
} from '@playwright/test';
import {
    getUrl, addNode, dragAndDrop, enableEditingNodes,
    loadSpecification, loadDataflow, openNodePalette,
} from './config.js';

async function assertOutputCount(page: Page, nodeName: string, count: number, nth = 0) {
    const inputs = await page
        .locator(`[data-node-type="${nodeName}"]`).nth(nth)
        .locator('.__interfaces .__outputs > div')
        .count();
    expect(inputs).toBe(count);
}
async function assertInputCount(page: Page, nodeName: string, count: number, nth = 0) {
    const inputs = await page
        .locator(`[data-node-type="${nodeName}"]`).nth(nth)
        .locator('.__interfaces .__inputs > div')
        .count();
    expect(inputs).toBe(count);
}
async function assertPropertyCount(page: Page, nodeName: string, count: number, nth = 0) {
    const props = await page
        .locator(`[data-node-type="${nodeName}"]`).nth(nth)
        .locator('.__properties > div')
        .count();
    expect(props).toBe(count);
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
    const value = await textarea.evaluate((el) => (<HTMLInputElement>el).value);
    return YAML.parse(value);
}
async function setYAMLEditorContent(page: Page, content: any) {
    const textarea = page.locator('textarea');
    await textarea.fill(YAML.stringify(content));
    await page.getByText('Apply', { exact: true }).click();
}
async function addInterface(page: Page, nodeName: string) {
    const node = page
        .locator(`.baklava-node[data-node-type="${nodeName}"]`)
        .first();
    await node.locator('.__title').click({ button: 'right', force: true });
    await node.locator('.baklava-context-menu').getByText('Add interface').click();
    await page.getByRole('button', { name: 'Add interface' }).click();
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

async function addAndOpenNode(page: Page, group: string, nodeName: string, x = 750, y = 180) {
    await addNode(page, group, nodeName, x, y);
    const node = page.locator(`[data-node-type="${nodeName}"]`).first();
    await node.locator('.__title').dblclick();
    const content = await getYAMLEditorContent(page);
    return { node, content };
}
async function reopenNode(page: Page, node: Locator) {
    await node.locator('.__title').dblclick();
    return getYAMLEditorContent(page);
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
    const parsedContent = await getYAMLEditorContent(page);

    // Retrieve the modified content of the YAML editor.
    await addInterface(page, nodeName);
    await assertInputCount(page, nodeName, 1);
    const modifiedParsedContent = await getYAMLEditorContent(page);

    // Count the number of elements in the `interfaces` attribute.
    const initialInterfacesCount = parsedContent.interfaces.length;
    const modifiedInterfacesCount = modifiedParsedContent.interfaces.length;

    expect(initialInterfacesCount).toBe(0);
    expect(modifiedInterfacesCount).toBe(1);
});
test('adding interface to YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-include-specification.json');
    const nodeName = 'LoadVideo';
    const { content } = await addAndOpenNode(page, 'Filesystem', nodeName);
    await assertInputCount(page, nodeName, 0);
    content.interfaces.push({
        name: 'new_interface',
        type: 'unique',
        direction: 'input',
    });
    await setYAMLEditorContent(page, content);
    await assertInputCount(page, nodeName, 1, 0);
    await assertInputCount(page, nodeName, 1, 1);
    // check if newly added nodes have this change
    await addNode(page, 'Filesystem', nodeName, 750, 160, false);
    await assertInputCount(page, nodeName, 1, 2);
});
test('adding property to YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-include-specification.json');
    const nodeName = 'LoadVideo';
    const { content } = await addAndOpenNode(page, 'Filesystem', nodeName);
    await assertPropertyCount(page, nodeName, 1);
    content.properties = [{
        name: 'new_property',
        type: 'integer',
        default: 0,
    }];
    await setYAMLEditorContent(page, content);
    await assertPropertyCount(page, nodeName, 2, 0);
    await assertPropertyCount(page, nodeName, 2, 1);
    // check if newly added nodes have this change
    await addNode(page, 'Filesystem', nodeName, 750, 160, false);
    await assertPropertyCount(page, nodeName, 2, 2);
});
test('removing interface from YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-include-specification.json');
    const nodeName = 'LoadVideo';
    const { content } = await addAndOpenNode(page, 'Filesystem', nodeName);
    await assertOutputCount(page, nodeName, 1, 0);
    await assertOutputCount(page, nodeName, 1, 1);
    content.interfaces = [];
    await setYAMLEditorContent(page, content);
    await assertOutputCount(page, nodeName, 0, 0);
    await assertOutputCount(page, nodeName, 0, 1);
    // check if newly added nodes have this change
    await addNode(page, 'Filesystem', nodeName, 750, 160, false);
    await assertOutputCount(page, nodeName, 0, 2);
});
test('editing property in YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-include-specification.json');
    const nodeName = 'GaussianKernel';
    const { node, content } = await addAndOpenNode(page, 'Generators', nodeName);

    content.properties.find((p) => p.name === 'size').name = 'width';
    Object.assign(
        content.properties.find((p) => p.name === 'sigma'),
        { type: 'bool', default: true },
    );
    await setYAMLEditorContent(page, content);
    await assertPropertyCount(page, nodeName, 3, 0);
    // check if newly added nodes have this change
    await addNode(page, 'Generators', nodeName, 750, 160, false);
    await assertPropertyCount(page, nodeName, 3, 1);
    const changedProp = node.locator('.__properties > div').getByText('width');
    expect(changedProp).toBeVisible();
    const checkbox = node.locator('.__properties > div').locator('.baklava-checkbox');
    expect(checkbox).toBeVisible();
});
test('editing interface in YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-include-specification.json');
    const nodeName = 'LoadVideo';
    const { node, content } = await addAndOpenNode(page, 'Filesystem', nodeName);
    await assertInputCount(page, nodeName, 0);
    await assertOutputCount(page, nodeName, 1);

    content.interfaces.find((p) => p.name === 'frames').direction = 'input';
    await setYAMLEditorContent(page, content);
    await assertInputCount(page, nodeName, 1);
    await assertOutputCount(page, nodeName, 0);

    content.interfaces.find((p) => p.name === 'frames').name = 'unique_input';
    await setYAMLEditorContent(page, content);
    await assertInputCount(page, nodeName, 1);
    await assertOutputCount(page, nodeName, 0);
    expect(node.getByText('unique_input')).toBeVisible();

    // check if newly added nodes have this change
    await addNode(page, 'Filesystem', nodeName, 750, 160, false);
    await assertInputCount(page, nodeName, 1, 2);
    await assertOutputCount(page, nodeName, 0, 2);
});
test('interface maxConnectionCount YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-include-specification.json');
    const nodeName = 'GaussianKernel';
    const { node, content } = await addAndOpenNode(page, 'Generators', nodeName);
    await assertOutputCount(page, nodeName, 1);
    const intf = node.locator('.__interfaces .__outputs > div');
    expect(intf).toHaveClass('baklava-node-interface --output --connected');

    content.interfaces[0].maxConnectionsCount = 0;
    await setYAMLEditorContent(page, content);
    await assertOutputCount(page, nodeName, 1);
    expect(intf).not.toHaveClass('baklava-node-interface --output --connected');
});
test('subgraph cascade interface YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-subgraph-specification.json');
    await loadDataflow(page, 'sample-subgraph-dataflow.json');
    await enableEditingNodes(page);
    const node = page.locator(`[data-node-type="Test subgraph #1"]`).first();
    const intf = node.getByText('Subgraph Output 2').locator('../..');
    expect(intf).toHaveClass('baklava-node-interface --output --connected');

    // enter subgraph
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Go to graph');
    await contextMenuOption.click();

    // edit interface that is exposed in the subgraph
    const subnode = page.locator(`[data-node-type="Test node #1"]`).nth(1);
    subnode.locator('.__title').dblclick();
    const content = await getYAMLEditorContent(page);
    content.interfaces.find((i) => i.name === 'Output').type = 'non-valid';
    await setYAMLEditorContent(page, content);

    // leave
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();

    expect(intf).not.toHaveClass('baklava-node-interface --output --connected');
});
test('subgraph cascade property YAML', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-subgraph-specification.json');
    await loadDataflow(page, 'sample-subgraph-dataflow.json');
    await enableEditingNodes(page);
    const node = page.locator(`[data-node-type="Test subgraph #2"]`).first();
    const prop = node.locator('.__properties').locator('.baklava-node-interface');
    // first property type
    expect(prop.locator('.baklava-select')).toBeVisible();

    // enter subgraph
    await node.locator('.__title').click({ button: 'right' });
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Go to graph');
    await contextMenuOption.click();

    // change prop
    const subnode = page.locator(`[data-node-type="Test node #2"]`);
    subnode.locator('.__title').dblclick();
    const content = await getYAMLEditorContent(page);
    const cprop = content.properties[0];
    delete cprop.values;
    cprop.type = 'integer';
    cprop.default = 2137;
    await setYAMLEditorContent(page, content);
    // leave
    const leaveButton = page.getByText('Return from subgraph editor').locator('../..');
    await leaveButton.click();
    // first property type
    expect(prop.locator('.baklava-select')).not.toBeVisible();
    expect(prop.locator('.baklava-num-input')).toBeVisible();
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
