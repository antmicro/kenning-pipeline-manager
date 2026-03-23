import YAML from 'yaml';
import {
    test, expect, Page, Locator,
} from '@playwright/test';
import {
    getUrl, addNode, enableEditingNodes, loadSpecification, loadDataflow,
} from './config.js';

async function getYAMLEditorContent(page: Page) {
    const textarea = page.locator('textarea');
    const value = await textarea.evaluate((el) => el.value);
    return value;
}
async function setYAMLEditorContent(page: Page, content: string) {
    const textarea = page.locator('textarea');
    await textarea.fill(content);
}

async function addProperty(page: Page, node: Locator) {
    await node.locator('.__title').click({ button: 'right', force: true });
    await node.locator('.baklava-context-menu').getByText('Add property').click();
    await page.getByRole('button', { name: 'Add property' }).click();
}

async function addSubgraph(node: Locator) {
    const title = node.locator('.__title');
    await title.click({ button: 'right' });
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Add subgraph');
    await contextMenuOption.click({force: true});
    expect(await title.locator('.__subgraph-icon').first()).toBeVisible({ timeout: 5_000 });
}

async function checkForSubgraph(node: Locator) {
    const contextMenuOption = node.locator('.baklava-context-menu').getByText('Go to graph');
    expect(await contextMenuOption).toHaveCount(1,{ timeout: 10_000 });
    await node.locator('.__title').click({ button: 'right'});
    expect(await contextMenuOption).toBeVisible();
    await node.locator('.__title').click({ button: 'right' });
}

test('checking inherited properties', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-inheritance-specification.json');
    await loadDataflow(page, 'sample-inheritance-dataflow.json');

    await enableEditingNodes(page);

    const node = page.locator('[data-node-type="Type B"]');
    await node.locator('.__title').dblclick();

    const initialContent = await getYAMLEditorContent(page);
    const parsedContent = YAML.parse(initialContent);
    expect(parsedContent.properties.length).toBe(1);

    await addProperty(page, node);

    const modifiedContent = await getYAMLEditorContent(page);
    const modifiedParsedContent = YAML.parse(modifiedContent);
    expect(modifiedParsedContent.properties.length).toBe(2);
});
test('check added inherited property in spec', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-inheritance-specification.json');

    await enableEditingNodes(page);

    await addNode(page, 'Classes', 'Type A', 400, 200);
    await addProperty(page, page.locator('[data-node-type="Type A"]'));
    await addNode(page, 'Classes', 'Type B', 700, 200, false);
    const nodeB = page.locator('[data-node-type="Type B"]');
    await nodeB.locator('.__title').dblclick();
    const initialContent = await getYAMLEditorContent(page);
    const parsedContent = YAML.parse(initialContent);
    expect(parsedContent.properties.length).toBe(1);
    const nodeBproperties = nodeB.locator('.__content > .__properties > div');
    expect(await nodeBproperties.count()).toBe(3);
});
test('checking renamed inherited property', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-inheritance-specification.json');
    await loadDataflow(page, 'sample-inheritance-dataflow.json');

    await enableEditingNodes(page);

    const nodeA = page.locator('[data-node-type="Type A"]');
    await nodeA.locator('.__title').dblclick();

    const initialContent = await getYAMLEditorContent(page);
    const parsedContent = YAML.parse(initialContent);
    expect(parsedContent.properties.length).toBe(1);
    parsedContent.properties.find((prop) => prop.name === 'prop-a').name = 'prop-new';
    await setYAMLEditorContent(page, YAML.stringify(parsedContent));
    await page.locator('.__validate-button').getByText('Apply').click();

    const nodeBproperties = page.locator('[data-node-type="Type B"]')
        .locator('.__content > .__properties > div');
    expect(await nodeBproperties.count()).toBe(2);
});
test('override interface', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-inheritance-specification.json');
    await loadDataflow(page, 'sample-inheritance-dataflow.json');

    await enableEditingNodes(page);

    const nodeB = page.locator('[data-node-type="Type B"]')
        .locator('.__title').first();
    await nodeB.dblclick();

    const initialContent = await getYAMLEditorContent(page);
    const parsedContent = YAML.parse(initialContent);
    expect(parsedContent.interfaces.length).toBe(1);
    parsedContent.interfaces.push(Object.fromEntries([
        ['name', 'output-a'],
        ['type', 'Interface'],
        ['direction', 'inout'],
        ['override', true],
        ['side', 'right'],
    ]));
    await setYAMLEditorContent(page, YAML.stringify(parsedContent));
    await page.locator('.__validate-button').getByText('Apply').click();
    const rightOutputs = page.locator('[data-node-type="Type B"]')
        .locator('.__content > .__interfaces > .__outputs > div');
    expect(await rightOutputs.count()).toBe(2);

    const editedContent = await getYAMLEditorContent(page);
    const editedParsedContent = YAML.parse(editedContent);
    expect(editedParsedContent.interfaces.length).toBe(2);
    editedParsedContent.interfaces.pop();
    await setYAMLEditorContent(page, YAML.stringify(editedParsedContent));
    await page.locator('.__validate-button').getByText('Apply').click();
    expect(await rightOutputs.count()).toBe(1);
});
test('add subgraph to child node', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-inheritance-specification.json');
    await loadDataflow(page, 'sample-inheritance-dataflow.json');

    await enableEditingNodes(page);

    const node = page.locator('[data-node-type="Type E"]');
    await addSubgraph(node);
    await checkForSubgraph(node);

    const outputs = await node.locator('.__content > .__interfaces > .__outputs > div').count();
    const inputs = await node.locator('.__content > .__interfaces > .__inputs > div').count();
    expect(inputs + outputs).toBe(5);
});
