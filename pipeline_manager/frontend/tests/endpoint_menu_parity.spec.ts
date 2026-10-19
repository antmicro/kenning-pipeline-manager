/*
 * Tests below check that every endpoint behaves the same way as the corresponding
 * file menu option.
 */

import { test, expect, Page } from '@playwright/test';
import { callFrontendRPC, prepareEditor } from './utils/endpoints';

type Action = (page: Page) => Promise<unknown>;
type MenuEndpointPair = { endpoint: string, menuItem: string, viaMenu: Action, viaRPC: Action };

/**
 * Pairs of a file menu option and an equivalent RPC call.
 */
const menuEndpointPairs: MenuEndpointPair[] = [
    {
        endpoint: 'graph_add',
        menuItem: 'Create new graph',
        viaMenu: async (page) => {
            await clickMenuItem(page, 'Create new graph');
        },
        viaRPC: async (page) => {
            await callFrontendRPC(page, 'graph_add');
        },
    },
];

/**
 * Simulates menu item click.
 */
async function clickMenuItem(page: Page, text: string) {
    await page.locator('.logo').hover();
    await page.getByText(text, { exact: true }).click();
}

/**
 * Returns the dataflow in a comparable form.
 */
async function getComparableDataflow(page: Page) {
    const { dataflow } = (await callFrontendRPC(page, 'graph_get')).result;
    dataflow.graphs.forEach((graph: any) => graph.connections?.forEach((connection: any) => {
        delete connection.id;
    }));
    return JSON.parse(JSON.stringify(dataflow).split(dataflow.entryGraph).join('displayed-graph'));
}

/**
 * Captures what the user can observe after an action.
 */
async function getEditorState(page: Page) {
    const dataflow = await getComparableDataflow(page);
    const title = await page.locator('.editorTitle').first().textContent();
    await page.locator('.baklava-editor').focus();
    await page.keyboard.press('Control+KeyZ');
    const undone = await getComparableDataflow(page);
    return { dataflow, title, undone };
}

/**
 * Runs the action on a freshly loaded editor and returns its outcome.
 */
async function runOnFreshEditor(page: Page, action: Action) {
    await prepareEditor(page);
    const output = await action(page);
    const state = await getEditorState(page);
    return { output, state };
}

menuEndpointPairs.forEach(({
    endpoint, menuItem, viaMenu, viaRPC,
}) => {
    test(`test ${endpoint} behaves like "${menuItem}" menu option`, async ({ page }) => {
        const menuOutcome = await runOnFreshEditor(page, viaMenu);
        const rpcOutcome = await runOnFreshEditor(page, viaRPC);
        expect(rpcOutcome).toEqual(menuOutcome);
    });
});
