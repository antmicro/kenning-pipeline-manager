/*
 * Tests below check that every endpoint behaves the same way as the corresponding
 * file menu option.
 */

import { test, expect, Page } from '@playwright/test';
import fs from 'fs/promises';
import { getPathToJsonFile, expectNoErrors } from './config.js';
import { callFrontendRPC, prepareEditor } from './utils/endpoints';

const otherSpecificationPath = getPathToJsonFile('sample-styling-specification.json');

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
    {
        endpoint: 'specification_change',
        menuItem: 'Load specification',
        viaMenu: async (page) => {
            const fileChooserPromise = page.waitForEvent('filechooser');
            await clickMenuItem(page, 'Load specification');
            await (await fileChooserPromise).setFiles(otherSpecificationPath);
            await expectNoErrors(page);
            return getSpecification(page);
        },
        viaRPC: async (page) => {
            const specification = JSON.parse(
                await fs.readFile(otherSpecificationPath, 'utf-8'),
            );
            await callFrontendRPC(page, 'specification_change', { specification });
            await expectNoErrors(page);
            return getSpecification(page);
        },
    },
    {
        endpoint: 'frontend_specification_get',
        menuItem: 'Save specification as...',
        viaMenu: async (page) => {
            await clickMenuItem(page, 'Save specification as...');
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Save', exact: true }).click();
            return JSON.parse(await fs.readFile(await (await downloadPromise).path(), 'utf-8'));
        },
        viaRPC: async (page) => getSpecification(page),
    },
    {
        endpoint: 'graph_set_name',
        menuItem: 'Set graph name',
        viaMenu: async (page) => {
            await clickMenuItem(page, 'Set graph name');
            const titleInput = page.locator('.editorTitleInput input');
            await titleInput.fill('Renamed graph');
            await titleInput.press('Enter');
        },
        viaRPC: async (page) => {
            await callFrontendRPC(page, 'graph_set_name', { name: 'Renamed graph' });
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
 * Returns the currently loaded specification.
 */
async function getSpecification(page: Page) {
    return (await callFrontendRPC(page, 'frontend_specification_get')).result.specification;
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
