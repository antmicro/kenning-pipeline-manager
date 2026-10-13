import { test, expect, Page } from '@playwright/test';
import {
    getUrl, loadSpecification, loadDataflow, verifyNodeCount, expectNoErrors,
} from './config.js';

/**
 * Sends a JSON-RPC request to the frontend through `postMessage`
 * and waits for the response.
 */
async function callFrontendRPC(page: Page, method: string, params?: object) {
    return page.evaluate(([rpcMethod, rpcParams]) => new Promise((resolve) => {
        const id = `test-${rpcMethod}-${Date.now()}`;
        const listener = (event: MessageEvent) => {
            if (event.data?.id !== id || !('result' in event.data || 'error' in event.data)) return;
            window.removeEventListener('message', listener);
            resolve(event.data);
        };
        window.addEventListener('message', listener);
        window.postMessage({
            jsonrpc: '2.0', id, method: rpcMethod, params: rpcParams,
        }, '*');
    }), [method, params] as const) as Promise<any>;
}

async function prepareEditor(page: Page) {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-specification.json');
    await loadDataflow(page, 'sample-dataflow.json');
    await expectNoErrors(page);
}

test('test graph_add endpoint', async ({ page }) => {
    await prepareEditor(page);
    const before = (await callFrontendRPC(page, 'graph_get')).result.dataflow;

    const response = await callFrontendRPC(page, 'graph_add', { name: 'Added graph' });
    expect(response.error).toBeUndefined();
    const graphId = response.result.graph_id;

    // New graph is empty and displayed
    await verifyNodeCount(page, 0);
    await expect(page.locator('.editorTitle').getByText('Added graph')).toBeVisible();

    const after = (await callFrontendRPC(page, 'graph_get')).result.dataflow;
    expect(after.graphs.map((g: any) => g.id))
        .toEqual(expect.arrayContaining([...before.graphs.map((g: any) => g.id), graphId]));
    expect(after.entryGraph).toBe(graphId);
    expect(after.graphs.find((g: any) => g.id === graphId).name).toBe('Added graph');
});

test('test graph_set_name endpoint', async ({ page }) => {
    await prepareEditor(page);

    const response = await callFrontendRPC(page, 'graph_set_name', { name: 'Renamed graph' });
    expect(response.error).toBeUndefined();

    await expect(page.locator('.editorTitle').getByText('Renamed graph')).toBeVisible();
    const { dataflow } = (await callFrontendRPC(page, 'graph_get')).result;
    expect(dataflow.graphs.find((g: any) => g.id === dataflow.entryGraph).name)
        .toBe('Renamed graph');
});
