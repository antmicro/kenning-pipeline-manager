import YAML from 'yaml';
import {
    test, expect, Page, FileChooser,
} from '@playwright/test';
import { setTimeout } from 'timers/promises';
import {
    getPathToJsonFile, getUrl, addNode,
    dragAndDrop, enableEditingNodes, loadSpecification, loadDataflow,
} from './config.js';
import { parse } from 'path';

async function getYAMLEditorContent(page: Page) {
    const textarea = page.locator('textarea');
    const value = await textarea.evaluate((el) => el.value);
    return value;
}
async function setYAMLEditorContent(page: Page, content: string) {
    const textarea = page.locator('textarea');
    await textarea.fill(content);
}

async function addProperty(page: Page, nodeName: string) {
    const node = page.getByText(nodeName).last();
    await node.click({ button: 'right', force: true });
    await page.getByText('Add property').click();
    await page.getByRole('button', { name: 'Add property' }).click();
}

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
test('check added inherited property in spec', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-inheritance-specification.json');

    await enableEditingNodes(page);

    await addNode(page, 'Classes', 'Type A', 400, 200);
    await addProperty(page, 'Type A');
    await addNode(page, 'Classes', 'Type B', 700, 200);
    const nodeB = page.locator('[data-node-type="Type B"]').locator('.__title').first();
    await nodeB.dblclick();
    const initialContent = await getYAMLEditorContent(page);
    const parsedContent = YAML.parse(initialContent);
    expect(parsedContent.properties.length).toBe(1);
    const nodeBproperties = page.locator('[data-node-type="Type B"]').locator('.__content > .__properties > div');
    expect(await nodeBproperties.count()).toBe(3);
});
test('checking renamed inherited property', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-inheritance-specification.json');
    await loadDataflow(page, 'sample-inheritance-dataflow.json');

    await enableEditingNodes(page);

    const nodeA = page
        .locator('div')
        .filter({ hasText: /^Type A$/ })
        .nth(3);
    await nodeA.dblclick();

    const initialContent = await getYAMLEditorContent(page);
    const parsedContent = YAML.parse(initialContent);
    expect(parsedContent.properties.length).toBe(1);
    parsedContent.properties.find((prop) => prop.name === 'prop-a').name = 'prop-new';
    await setYAMLEditorContent(page, YAML.stringify(parsedContent));
    await page.locator('.__validate-button').click();

    const nodeBproperties = page
        .locator('div')
        .filter({ hasText: /^Type B$/ })
        .nth(4)
        .locator('..')
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
    await page.locator('.__validate-button').click();
    const rightOutputs = page.locator('[data-node-type="Type B"]')
        .locator('.__content > .__interfaces > .__outputs > div');
    expect(await rightOutputs.count()).toBe(2);

    const editedContent = await getYAMLEditorContent(page);
    const editedParsedContent = YAML.parse(editedContent);
    expect(editedParsedContent.interfaces.length).toBe(2);
    editedParsedContent.interfaces.pop();
    await setYAMLEditorContent(page, YAML.stringify(editedParsedContent));
    await page.locator('.__validate-button').click();
    expect(await rightOutputs.count()).toBe(1);
});
