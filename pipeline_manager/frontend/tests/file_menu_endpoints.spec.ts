import { test, expect } from '@playwright/test';
import { verifyNodeCount } from './config.js';
import { callFrontendRPC, prepareEditor } from './utils/endpoints';

type Graph = { id: string, name: string, nodes: { id: string }[] };

test.beforeEach(async ({ page }) => {
    await prepareEditor(page);
});

test('test graph_add endpoint', async ({ page }) => {
    const before = (await callFrontendRPC(page, 'graph_get')).result.dataflow;

    const response = await callFrontendRPC(page, 'graph_add', { name: 'Added graph' });
    expect(response.error).toBeUndefined();
    const graphId = response.result.graph_id;

    // New graph is empty and displayed
    await verifyNodeCount(page, 0);
    await expect(page.locator('.editorTitle').getByText('Added graph')).toBeVisible();

    const after = (await callFrontendRPC(page, 'graph_get')).result.dataflow;
    expect(after.graphs.map((g: Graph) => g.id))
        .toEqual(expect.arrayContaining([...before.graphs.map((g: Graph) => g.id), graphId]));
    expect(after.entryGraph).toBe(graphId);
    expect(after.graphs.find((g: Graph) => g.id === graphId).name).toBe('Added graph');
});

test('test graph_set_name endpoint', async ({ page }) => {
    const response = await callFrontendRPC(page, 'graph_set_name', { name: 'Renamed graph' });
    expect(response.error).toBeUndefined();

    await expect(page.locator('.editorTitle').getByText('Renamed graph')).toBeVisible();
    const { dataflow } = (await callFrontendRPC(page, 'graph_get')).result;
    expect(dataflow.graphs.find((g: Graph) => g.id === dataflow.entryGraph).name)
        .toBe('Renamed graph');
});

test('test layout_get endpoint', async ({ page }) => {
    const response = await callFrontendRPC(page, 'layout_get');
    expect(response.error).toBeUndefined();

    const { dataflow } = (await callFrontendRPC(page, 'graph_get')).result;
    const displayedGraph = dataflow.graphs.find((g: Graph) => g.id === dataflow.entryGraph);
    expect(Object.keys(response.result.layout).sort())
        .toEqual(displayedGraph.nodes.map((n: { id: string }) => n.id).sort());
});

test('test layout_set endpoint', async ({ page }) => {
    const { layout } = (await callFrontendRPC(page, 'layout_get')).result;

    const [nodeId] = Object.keys(layout);
    const position = { x: layout[nodeId].position.x + 100, y: layout[nodeId].position.y + 50 };
    layout[nodeId].position = position;

    const response = await callFrontendRPC(page, 'layout_set', { layout });
    expect(response.error).toBeUndefined();
    expect(response.result.errors).toEqual([]);

    const after = (await callFrontendRPC(page, 'layout_get')).result.layout;
    expect(after[nodeId].position).toEqual(position);
});

test('test graph_export_image endpoint png', async ({ page }) => {
    const response = await callFrontendRPC(
        page, 'graph_export_image', { format: 'png', width: 800, height: 600 },
    );
    expect(response.error).toBeUndefined();
    expect(response.result.format).toBe('png');

    const prefix = 'data:image/png;base64,';
    expect(response.result.data.startsWith(prefix)).toBe(true);
});

test('test graph_export_image endpoint svg', async ({ page }) => {
    const response = await callFrontendRPC(page, 'graph_export_image', { format: 'svg' });
    expect(response.error).toBeUndefined();
    expect(response.result.format).toBe('svg');
    expect(response.result.data.startsWith('data:image/svg+xml')).toBe(true);
});
