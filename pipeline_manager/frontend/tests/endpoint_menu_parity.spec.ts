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
 * Returns the layout of the displayed graph.
 */
async function getLayoutViaRPC(page: Page) {
    const { result } = await callFrontendRPC(page, 'layout_get');
    delete result.graph_id;
    return result;
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
        // eslint-disable-next-line no-param-reassign
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
        // eslint-disable-next-line no-param-reassign
        node.position.x += 100;
        // eslint-disable-next-line no-param-reassign
        node.position.y += 50;
    });
    return { layout };
}

/**
 * Replaces random class names that html-to-image generates with consistent names.
 */
function normalizeSvg(svg: string) {
    const names = [...svg.matchAll(/<style>\.(\w+)::/g)].map(([, name]) => name);
    return names.reduce((result, name, i) => result.split(name).join(`pseudo-${i}`), svg);
}

/**
 * Returns the dataflow in a comparable form.
 */
async function getComparableDataflow(page: Page, dataflow?: any) {
    const comparable = dataflow ?? (await callFrontendRPC(page, 'graph_get')).result.dataflow;
    comparable.graphs.forEach((graph: any) => graph.connections?.forEach((connection: any) => {
        // eslint-disable-next-line no-param-reassign
        delete connection.id;
    }));
    return JSON.parse(
        JSON.stringify(comparable).split(comparable.entryGraph).join('displayed-graph'),
    );
}

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
    {
        endpoint: 'layout_get',
        menuItem: 'Save layout',
        viaMenu: async (page) => {
            const downloadPromise = page.waitForEvent('download');
            await clickMenuItem(page, 'Save layout');
            return JSON.parse(await fs.readFile(await (await downloadPromise).path(), 'utf-8'));
        },
        viaRPC: getLayoutViaRPC,
    },
    {
        endpoint: 'layout_get',
        menuItem: 'Save layout as file as...',
        viaMenu: async (page) => {
            await clickMenuItem(page, 'Save layout as file as...');
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Save', exact: true }).click();
            return JSON.parse(await fs.readFile(await (await downloadPromise).path(), 'utf-8'));
        },
        viaRPC: getLayoutViaRPC,
    },
    {
        endpoint: 'graph_export_image',
        menuItem: 'Export graph to PNG',
        viaMenu: async (page) => {
            await clickMenuItem(page, 'Export graph to PNG');
            const downloadPromise = page.waitForEvent('download');
            await page.getByRole('button', { name: 'Export', exact: true }).click();
            return fs.readFile(await (await downloadPromise).path());
        },
        viaRPC: async (page) => {
            const { data } = (await callFrontendRPC(
                page, 'graph_export_image', { format: 'png' },
            )).result;
            return Buffer.from(data.slice(data.indexOf(',') + 1), 'base64');
        },
    },
    {
        endpoint: 'graph_export_image',
        menuItem: 'Export graph to HTML-based SVG',
        viaMenu: async (page) => {
            const downloadPromise = page.waitForEvent('download');
            await clickMenuItem(page, 'Export graph to HTML-based SVG');
            return normalizeSvg(await fs.readFile(await (await downloadPromise).path(), 'utf-8'));
        },
        viaRPC: async (page) => {
            const { data } = (await callFrontendRPC(
                page, 'graph_export_image', { format: 'svg' },
            )).result;
            return normalizeSvg(decodeURIComponent(data.slice(data.indexOf(',') + 1)));
        },
    },
];

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
