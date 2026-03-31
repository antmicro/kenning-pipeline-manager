import YAML from 'yaml';
import {
    test, expect, Page, Locator,
} from '@playwright/test';
import {
    setYAMLEditorContent,getYAMLEditorContent,getUrl, addProperty, checkForSubgraph, addSubgraph, addNode, enableEditingNodes, loadSpecification, loadDataflow,
} from './config.js';


test('checking inherited properties', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-inheritance-specification.json');
    await loadDataflow(page, 'sample-inheritance-dataflow.json');

    await enableEditingNodes(page);

    const node = page.locator('[data-node-type="Type B"]');
    await node.locator('.__title').dblclick();

    const parsedContent = await getYAMLEditorContent(page);
    expect(parsedContent.properties.length).toBe(1);

    await addProperty(page, node);

    const modifiedParsedContent = await getYAMLEditorContent(page);
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
    const parsedContent = await getYAMLEditorContent(page);
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

    const parsedContent = await getYAMLEditorContent(page);
    expect(parsedContent.properties.length).toBe(1);
    parsedContent.properties.find((prop) => prop.name === 'prop-a').name = 'prop-new';
    await setYAMLEditorContent(page, parsedContent);

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

    const parsedContent = await getYAMLEditorContent(page);
    expect(parsedContent.interfaces.length).toBe(1);
    parsedContent.interfaces.push(Object.fromEntries([
        ['name', 'output-a'],
        ['type', 'Interface'],
        ['direction', 'inout'],
        ['override', true],
        ['side', 'right'],
    ]));
    await setYAMLEditorContent(page, parsedContent);
    const rightOutputs = page.locator('[data-node-type="Type B"]')
        .locator('.__content > .__interfaces > .__outputs > div');
    expect(await rightOutputs.count()).toBe(2);

    const editedParsedContent = await getYAMLEditorContent(page);
    expect(editedParsedContent.interfaces.length).toBe(2);
    editedParsedContent.interfaces.pop();
    await setYAMLEditorContent(page, editedParsedContent);
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
