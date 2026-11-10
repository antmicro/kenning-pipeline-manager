import {
    test, expect, type Page, type Locator,
} from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
    getUrl, loadSpecification, loadDataflow, AddConnection, getContextMenu, expectNoErrors,
    getPathToJsonFile, saveFileAs, openFileChooser, getNode,
} from './config.js';

const subInterfaceNames = ['AW', 'W', 'B', 'AR', 'R'];

function leafInterfaceCount(compositeName: any, composites: any) {
    const subs = composites[compositeName];
    if (subs === undefined) return 1;
    return subs.reduce(
        (sum: any, sub: any) => {
            const count = (sub.array?.[1] ?? 1) - (sub.array?.[0] ?? 0);

            return sum + (composites[sub.type] !== undefined
                ? leafInterfaceCount(sub.type, composites) * count : count);
        },
        0,
    );
}

const specification = JSON.parse(
    readFileSync(getPathToJsonFile('sample-composite-specification.json'), 'utf-8'),
);
const axiLeafPairs = leafInterfaceCount('axi', specification.interfaceComposites);

function subRow(scope: Locator, name: string) {
    return scope.locator(`[data-port-name="${name}"].--composite-sub`);
}

function compositeToggle(scope: Locator, name: string) {
    return scope.locator(
        `[data-port-name="${name}"].baklava-node-interface > .__port_composite > .__port_composite_toggle`,
    );
}

function compositeAnchor(scope: Locator) {
    return scope.locator('.__port_composite_port');
}

async function loadCompositeGraph(page: Page) {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-composite-specification.json');
    await loadDataflow(page, 'sample-composite-dataflow.json');
    await expect(getNode(page, 'CompositeGenerator')).toBeVisible();
    await expect(getNode(page, 'CompositeConsumer')).toBeVisible();
}

async function toggleAllCompositeInterfaces(page: Page, expand = true) {
    const centerButton = page.locator('.zoom-center');
    const toggleClasses = (expand) ?
        '.chevron.right.__port_composite_toggle, .chevron.left.__port_composite_toggle'
        : '.chevron.down.__port_composite_toggle';
    // let chevronCollapsed = await page.locator(collapsedClasses).all();
    while (true) {
        await centerButton.click();
        const c = await page.locator(toggleClasses).first().all();
        if (c.length) {
            await c[0].click();
        } else {
            break;
        }
    }
}

test('composite interfaces are rendered collapsed by default', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = getNode(page, 'CompositeGenerator');

    await expect(generator.locator('.__port_composite')).toHaveCount(1);
    await expect(
        generator.locator('.__port:not(.__port_composite_port)'),
    ).toHaveCount(1);
    await expect(generator.locator('.--composite-sub')).toHaveCount(0);

    await expectNoErrors(page);
});

test('unrolling a composite interface hides its port and renders the sub-interfaces', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = getNode(page, 'CompositeGenerator');
    await compositeToggle(generator, 'axi').click();

    await expect(generator.locator('.__port_composite_port_hidden')).toHaveCount(1);

    await expect(generator.locator('.--composite-sub')).toHaveCount(subInterfaceNames.length);
    for (const name of subInterfaceNames) {
        // eslint-disable-next-line no-await-in-loop
        await expect(subRow(generator, name)).toHaveCount(1);
    }

    await compositeToggle(generator, 'axi').click();
    await expect(generator.locator('.__port_composite_port')).toHaveCount(1);
    await expect(generator.locator('.--composite-sub')).toHaveCount(0);

    await compositeToggle(generator, 'axi').click();
    await expectNoErrors(page);
});

const baseCollapsedCount = 3;
const baseConnectionCount = 47;

test('collapsing keeps sub-interface connections on the composite port', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = getNode(page, 'CompositeGenerator');
    const consumer = getNode(page, 'CompositeConsumer');
    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(baseCollapsedCount);

    await compositeToggle(generator, 'axi').click();
    await AddConnection(
        page,
        subRow(generator, 'W').locator('.__port'),
        subRow(consumer, 'W').locator('.__port'),
    );
    await expect(connections).toHaveCount(baseCollapsedCount + 1);
    await expect(subRow(generator, 'W')).toHaveClass(/--connected/);
    await expect(subRow(consumer, 'W')).toHaveClass(/--connected/);

    await compositeToggle(generator, 'axi').click();
    await expect(connections).toHaveCount(baseCollapsedCount + 1);
    await expect(subRow(generator, 'W')).toHaveCount(0);

    await compositeToggle(generator, 'axi').click();
    await expect(subRow(generator, 'W')).toHaveClass(/--connected/);
    await expect(connections).toHaveCount(baseCollapsedCount + 1);

    await expectNoErrors(page);
});

test('connections held by unrolled sub-ports are removed with the node', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = getNode(page, 'CompositeGenerator');
    const consumer = getNode(page, 'CompositeConsumer');
    const connections = page.locator('.custom-connections-container > g');

    await compositeToggle(generator, 'axi').click();
    await AddConnection(
        page,
        subRow(generator, 'W').locator('.__port'),
        subRow(consumer, 'W').locator('.__port'),
    );
    await expect(connections).toHaveCount(baseCollapsedCount + 1);

    await generator.locator('.__title').click({ button: 'right' });
    await getContextMenu(page).getByText('Delete').click({ force: true });
    await expect(connections).toHaveCount(0);

    await expectNoErrors(page);
});

test('connecting composite interfaces of the same exact type connects every matching sub-interface', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = getNode(page, 'CompositeGenerator');
    const consumer = getNode(page, 'CompositeConsumer');
    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(baseCollapsedCount);

    await compositeToggle(consumer, 'axi').click();
    await page.locator('.custom-connections-container > g').nth(0).dblclick({ force: true });
    await AddConnection(
        page, compositeAnchor(generator), compositeAnchor(consumer),
    );
    await expect(connections).toHaveCount(1);
    await toggleAllCompositeInterfaces(page);
    await expect(connections).toHaveCount(axiLeafPairs);

    await expectNoErrors(page);
});

test('connecting composite interfaces of different types is prevented', async ({ page }) => {
    await loadCompositeGraph(page);

    const syncGenerator = getNode(page, 'SyncGenerator');
    const syncConsumer = getNode(page, 'SyncConsumer');
    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(baseCollapsedCount);

    await AddConnection(
        page, compositeAnchor(syncGenerator), compositeAnchor(syncConsumer),
    );
    await expect(connections).toHaveCount(baseCollapsedCount);
    await expectNoErrors(page);
});

test('connecting a composite interface to a differently typed nested one is prevented', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = getNode(page, 'CompositeGenerator');
    const consumer = getNode(page, 'CompositeConsumer');
    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(baseCollapsedCount);

    await AddConnection(
        page,
        compositeAnchor(generator),
        subRow(consumer, 'AW').locator('.__port_composite_port'),
    );
    await expect(connections).toHaveCount(baseCollapsedCount);
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
    await expect(getNode(page, 'CompositeGenerator')).toBeVisible();
    await expect(getNode(page, 'CompositeConsumer')).toBeVisible();
}

test('manually connected sub-interfaces kept through save and load', async ({ page }, testInfo) => {
    const graphId = 'a1b2c3d4-0000-4000-8000-000000000001';
    const generatorId = 'a1b2c3d4-1111-4000-8000-000000000001';
    const consumerId = 'a1b2c3d4-3333-4000-8000-000000000001';
    await loadCompositeGraph(page);

    const generator = getNode(page, 'CompositeGenerator');
    const consumer = getNode(page, 'CompositeConsumer');
    const connections = page.locator('.custom-connections-container > g');

    await compositeToggle(generator, 'axi').click();
    await AddConnection(
        page,
        subRow(generator, 'W').locator('.__port'),
        subRow(consumer, 'W').locator('.__port'),
    );
    // When composite interfaces are collapsed only the top-most connections are drawn
    await expect(connections).toHaveCount(baseCollapsedCount + 1);
    await toggleAllCompositeInterfaces(page);
    // Expand all composite interfaces and count connections once more
    await expect(connections).toHaveCount(baseConnectionCount + 1);

    const filePath = await saveFileAs(page, testInfo, 'dataflow', 'composite-partial');
    const saved = JSON.parse(readFileSync(filePath, 'utf-8'));
    const savedGraph = saved.graphs.find((g: any) => g.id === graphId);

    const genAxi = savedCompositeInterface(savedGraph, generatorId);
    expect(genAxi.compositeExpanded).toBe(true);
    expect(genAxi.composite[1]).toEqual({ id: expect.any(String), name: 'W' });
    const consAxi = savedCompositeInterface(savedGraph, consumerId);
    expect(consAxi.compositeExpanded).toBe(true);
    expect(consAxi.composite[1]).toEqual({ id: expect.any(String), name: 'W' });
    expect(savedGraph.connections).toHaveLength(baseConnectionCount + 1);
    const conLast = savedGraph.connections.length - 1;
    expect(savedGraph.connections[conLast].from).toBe(genAxi.composite[1].id);
    expect(savedGraph.connections[conLast].to).toBe(consAxi.composite[1].id);

    await reloadDataflow(page, filePath);
    // Currently information about collapsed/expanded interfaces is limited
    // so loaded graph is mostly collapsed
    await expect(connections).toHaveCount(baseCollapsedCount + 1);
    await expect(subRow(generator, 'W')).toHaveClass(/--connected/);
    await expect(subRow(consumer, 'W')).toHaveClass(/--connected/);

    await expectNoErrors(page);
});
