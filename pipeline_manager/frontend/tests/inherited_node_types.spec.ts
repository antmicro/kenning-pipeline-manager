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
