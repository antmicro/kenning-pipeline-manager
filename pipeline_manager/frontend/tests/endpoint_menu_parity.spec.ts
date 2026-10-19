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
    {
        endpoint: 'graph_change',
        menuItem: 'Load graph file',
        viaMenu: async (page) => {
            const dataflowPath = test.info().outputPath('dataflow.json');
            await fs.writeFile(dataflowPath, JSON.stringify(await getOtherDataflow()));
            const fileChooserPromise = page.waitForEvent('filechooser');
            await clickMenuItem(page, 'Load graph file');
            await (await fileChooserPromise).setFiles(dataflowPath);
            await expectNoErrors(page);
        },
        viaRPC: async (page) => {
            await callFrontendRPC(page, 'graph_change', { dataflow: await getOtherDataflow() });
            await expectNoErrors(page);
        },
    },
    {
        endpoint: 'graph_get',
        menuItem: 'Save graph file',
        viaMenu: async (page) => {
            const downloadPromise = page.waitForEvent('download');
            await clickMenuItem(page, 'Save graph file');
            return getComparableDataflow(
                page,
                JSON.parse(await fs.readFile(await (await downloadPromise).path(), 'utf-8')),
            );
        },
        viaRPC: async (page) => getComparableDataflow(page),
    },
    {
        endpoint: 'graph_get',
        menuItem: 'Save graph as file as...',
        viaMenu: async (page) => {
            await clickMenuItem(page, 'Save graph as file as...');
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Save', exact: true }).click();
            return getComparableDataflow(
                page,
                JSON.parse(await fs.readFile(await (await downloadPromise).path(), 'utf-8')),
            );
        },
        viaRPC: async (page) => getComparableDataflow(page),
    },
    {
        endpoint: 'layout_set',
        menuItem: 'Load layout',
        viaMenu: async (page) => {
            const layoutPath = test.info().outputPath('layout.json');
            await fs.writeFile(layoutPath, JSON.stringify(await getMovedLayout(page)));
            const fileChooserPromise = page.waitForEvent('filechooser');
            await clickMenuItem(page, 'Load layout');
            await (await fileChooserPromise).setFiles(layoutPath);
            await expectNoErrors(page);
        },
        viaRPC: async (page) => {
            const { errors } = (await callFrontendRPC(
                page, 'layout_set', await getMovedLayout(page),
            )).result;
            expect(errors).toEqual([]);
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
 * Returns the sample dataflow with a renamed graph and moved nodes,
 * so that loading it changes the editor.
 */
async function getOtherDataflow() {
    const dataflow = JSON.parse(
        await fs.readFile(getPathToJsonFile('sample-dataflow.json'), 'utf-8'),
    );
    const [graph] = dataflow.graphs;
    graph.name = 'Loaded graph';
    graph.nodes.forEach((node: any) => {
        node.position.x += 100;
    });
    return dataflow;
}

/**
 * Returns the current layout with every node moved, so that loading it changes the editor.
 */
async function getMovedLayout(page: Page) {
    const { layout } = (await callFrontendRPC(page, 'layout_get')).result;
    Object.values(layout).forEach((node: any) => {
        node.position.x += 100;
        node.position.y += 50;
    });
    return { layout };
}

/**
 * Returns the dataflow in a comparable form.
 */
async function getComparableDataflow(page: Page, dataflow?: any) {
    const comparable = dataflow ?? (await callFrontendRPC(page, 'graph_get')).result.dataflow;
    comparable.graphs.forEach((graph: any) => graph.connections?.forEach((connection: any) => {
        delete connection.id;
    }));
    return JSON.parse(
        JSON.stringify(comparable).split(comparable.entryGraph).join('displayed-graph'),
    );
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
