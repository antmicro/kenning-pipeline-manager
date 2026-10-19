import { Page } from '@playwright/test';
import { getUrl, loadVideoNodeId } from '../config.js';

/**
 * Sends a JSON-RPC request to the frontend.
 */
export async function callFrontendRPC(page: Page, method: string, params?: object) {
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

/**
 * Opens a fresh editor and waits until the embedded sample dataflow is loaded.
 */
export async function prepareEditor(page: Page) {
    await page.goto(getUrl());
    await page.waitForSelector(`#${loadVideoNodeId}`);
}
