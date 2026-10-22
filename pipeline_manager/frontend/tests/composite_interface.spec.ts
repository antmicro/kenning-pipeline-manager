import { test, expect, type Page } from '@playwright/test';
import {
    getUrl, loadSpecification, loadDataflow, AddConnection, getContextMenu, expectNoErrors,
    getPathToJsonFile, saveFileAs, openFileChooser,
} from './config.js';

const graphId = 'a1b2c3d4-0000-4000-8000-000000000001';
const generatorId = 'a1b2c3d4-1111-4000-8000-000000000001';
const consumerId = 'a1b2c3d4-3333-4000-8000-000000000001';
const generatorAxiId = 'a1b2c3d4-2222-4000-8000-000000000001';
const consumerAxiId = 'a1b2c3d4-4444-4000-8000-000000000001';
const syncGeneratorId = 'a1b2c3d4-9999-4000-8000-000000000001';
const syncConsumerId = 'a1b2c3d4-7777-4000-8000-000000000001';

const subInterfaceNames = ['red', 'green', 'blue'];

async function loadCompositeGraph(page: Page) {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-composite-specification.json');
    await loadDataflow(page, 'sample-composite-dataflow.json');
    await expect(page.locator(`#${generatorId}`)).toBeVisible();
    await expect(page.locator(`#${consumerId}`)).toBeVisible();
}

test('composite interfaces are rendered collapsed by default', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    const consumer = page.locator(`#${consumerId}`);

    await expect(generator.locator('.__port_composite')).toHaveCount(1);
    await expect(consumer.locator('.__port_composite')).toHaveCount(1);
    await expect(
        generator.locator('.__port:not(.__port_composite_port)'),
    ).toHaveCount(1);
    await expect(generator.locator('.--composite-sub')).toHaveCount(0);
    await expect(consumer.locator('.--composite-sub')).toHaveCount(0);

    await expectNoErrors(page);
});

test('unrolling a composite interface hides its port and renders the sub-interfaces', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    await generator.locator('.__port_composite_toggle').click();

    await expect(generator.locator('.__port_composite_port_hidden')).toHaveCount(1);

    const subRows = generator.locator('.--composite-sub');
    await expect(subRows).toHaveCount(subInterfaceNames.length);
    // eslint-disable-next-line no-restricted-syntax
    for (const name of subInterfaceNames) {
        // eslint-disable-next-line no-await-in-loop
        await expect(generator.locator(`.--composite-sub:has-text("${name}")`)).toHaveCount(1);
    }

    await generator.locator('.__port_composite_toggle').click();
    await expect(generator.locator('.__port_composite_port_hidden')).toHaveCount(0);
    await expect(generator.locator('.--composite-sub')).toHaveCount(0);

    await generator.locator('.__port_composite_toggle').click();
    await expectNoErrors(page);
});

test('collapsing keeps sub-interface connections on the composite port', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(1);

    await generator.locator('.__port_composite_toggle').click();
    const redRow = generator.locator('.--composite-sub', { hasText: 'red' });
    const monitorPort = page.locator(
        `#${consumerId} .__port:not(.__port_composite_port)`,
    );
    await AddConnection(page, redRow.locator('.__port'), monitorPort);
    await expect(connections).toHaveCount(2);
    await expect(redRow).toHaveClass(/--connected/);

    await generator.locator('.__port_composite_toggle').click();
    await expect(connections).toHaveCount(2);

    await generator.locator('.__port_composite_toggle').click();
    await expect(
        generator.locator('.--composite-sub', { hasText: 'red' }),
    ).toHaveClass(/--connected/);

    await expectNoErrors(page);
});

test('connections held by unrolled sub-ports are removed with the node', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    const connections = page.locator('.custom-connections-container > g');

    await generator.locator('.__port_composite_toggle').click();
    const redRow = generator.locator('.--composite-sub', { hasText: 'red' });
    const monitorPort = page.locator(
        `#${consumerId} .__port:not(.__port_composite_port)`,
    );
    await AddConnection(page, redRow.locator('.__port'), monitorPort);
    await expect(connections).toHaveCount(2);

    await generator.locator('.__title').click({ button: 'right' });
    await getContextMenu(page).getByText('Delete').click({ force: true });
    await expect(connections).toHaveCount(0);

    await expectNoErrors(page);
});

test('connecting composite interfaces of the same exact type connects every matching sub-interface', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    const consumer = page.locator(`#${consumerId}`);
    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(0);

    // both composites are collapsed, so the connecting drag is performed
    // between their composite ports
    await AddConnection(
        page, compositeAnchor(generator), compositeAnchor(consumer),
    );
    // a single drag creates one connection per pair of (recursively) matching
    // sub-interfaces; with everything collapsed they all sit on the composite ports
    await expect(connections).toHaveCount(axiLeafPairs);

    // unrolling both shows the connections on every sub-interface row
    await compositeToggle(generator, 'axi').click();
    await compositeToggle(consumer, 'axi').click();
    // eslint-disable-next-line no-restricted-syntax
    for (const name of subInterfaceNames) {
        // eslint-disable-next-line no-await-in-loop
        await expect(subRow(generator, name)).toHaveClass(/--connected/);
        // eslint-disable-next-line no-await-in-loop
        await expect(subRow(consumer, name)).toHaveClass(/--connected/);
    }

    await compositeToggle(generator, 'AW').click();
    await expect(subRow(generator, 'ID')).toHaveClass(/--connected/);
    await compositeToggle(generator, 'ID').click();
    await expect(subRow(generator, 'ID[0]')).toHaveClass(/--connected/);

    await compositeToggle(generator, 'ID').click();
    await compositeToggle(generator, 'AW').click();
    await compositeToggle(generator, 'axi').click();
    await compositeToggle(consumer, 'axi').click();
    await expect(connections).toHaveCount(axiLeafPairs);

    // the composite interfaces are fully connected already, so dragging
    // between them again is refused
    await AddConnection(
        page, compositeAnchor(generator), compositeAnchor(consumer),
    );
    await expect(connections).toHaveCount(axiLeafPairs);

    await expectNoErrors(page);
});

test('connecting composite interfaces of different types is prevented', async ({ page }) => {
    await loadCompositeGraph(page);

    const syncGenerator = page.locator(`#${syncGeneratorId}`);
    const syncConsumer = page.locator(`#${syncConsumerId}`);
    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(0);

    await AddConnection(
        page, compositeAnchor(syncGenerator), compositeAnchor(syncConsumer),
    );
    await expect(connections).toHaveCount(0);
    await expectNoErrors(page);
});

test('connecting a composite interface to a differently typed nested one is prevented', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    const consumer = page.locator(`#${consumerId}`);
    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(0);

    // unroll the consumer's composite so the nested `AW` (of type `aw`) port
    // becomes draggable, and drag the generator's whole `axi` composite onto it
    await compositeToggle(consumer, 'axi').click();
    await AddConnection(
        page,
        compositeAnchor(generator),
        subRow(consumer, 'AW').locator('.__port_composite_port'),
    );
    await expect(connections).toHaveCount(0);
    await expectNoErrors(page);
});

function savedCompositeInterface(savedGraph: any, nodeId: string) {
    const node = savedGraph.nodes.find((n: any) => n.id === nodeId);
    return node.interfaces.find((i: any) => i.name === 'axi');
}

async function reloadDataflow(page: Page, dataflowPath: string) {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-composite-specification.json');
    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(dataflowPath);
    await expect(page.locator(`#${generatorId}`)).toBeVisible();
    await expect(page.locator(`#${consumerId}`)).toBeVisible();
}

test('manually connected sub-interfaces kept through save and load', async ({ page }, testInfo) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    const consumer = page.locator(`#${consumerId}`);
    const connections = page.locator('.custom-connections-container > g');

    await compositeToggle(generator, 'axi').click();
    await compositeToggle(consumer, 'axi').click();
    await AddConnection(
        page,
        subRow(generator, 'W').locator('.__port'),
        subRow(consumer, 'W').locator('.__port'),
    );
    await expect(connections).toHaveCount(1);

    const filePath = await saveFileAs(page, testInfo, 'dataflow', 'composite-partial');
    const saved = JSON.parse(readFileSync(filePath, 'utf-8'));
    const savedGraph = saved.graphs.find((g: any) => g.id === graphId);

    // only the connected sub-port is reported, and the expansion state is saved
    const genAxi = savedCompositeInterface(savedGraph, generatorId);
    expect(genAxi.compositeExpanded).toBe(true);
    expect(genAxi.composite).toEqual([{ id: expect.any(String), name: 'W' }]);
    const consAxi = savedCompositeInterface(savedGraph, consumerId);
    expect(consAxi.composite).toEqual([{ id: expect.any(String), name: 'W' }]);
    expect(savedGraph.connections).toHaveLength(1);
    expect(savedGraph.connections[0].from).toBe(genAxi.composite[0].id);
    expect(savedGraph.connections[0].to).toBe(consAxi.composite[0].id);

    await reloadDataflow(page, filePath);
    await expect(connections).toHaveCount(1);
    await expect(subRow(generator, 'W')).toHaveClass(/--connected/);
    await expect(subRow(consumer, 'W')).toHaveClass(/--connected/);

    await expectNoErrors(page);
});
