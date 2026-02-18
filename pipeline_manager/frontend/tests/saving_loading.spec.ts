import os from 'os';
import fs from 'fs/promises';
import {
    test, expect, Page,
} from '@playwright/test';
import {
    getUrl, loadSpecification, loadDataflow, openFileChooser, getPathToJsonFile,
} from './config.js';

const temporaryDir = `${os.tmpdir()}/`;

async function expectNoErrors(page: Page) {
    const notifications = page.locator('.notifications > .panel > ul > *:not(:has(.info))');
    const c = await notifications.count();
    expect(c).toBe(0);
}
async function saveFileAs(
    page: Page,
    purpose: string,
    filenameWithoutExtension: string,
): Promise<string> {
    const text = (purpose === 'specification' ? 'Save specification as...' : 'Save graph as file as...');
    const logo = page.locator('.logo');
    await logo.hover();
    const saveAsMenuOption = page.getByRole('button', { name: text });
    await saveAsMenuOption.click();

    await page.getByPlaceholder('File name').first().fill(filenameWithoutExtension);
    const saveAsButton = page.getByRole('button', { name: 'Save' });

    const downloadPromise = page.waitForEvent('download');
    await saveAsButton.click();
    const download = await downloadPromise;

    const downloadedFilePath = temporaryDir + download.suggestedFilename();
    await download.saveAs(downloadedFilePath);

    return downloadedFilePath;
}
async function saveSpecificationAs(page: Page, filenameWithoutExtension: string): Promise<string> {
    return saveFileAs(page, 'specification', filenameWithoutExtension);
}
async function saveDataflowAs(page: Page, filenameWithoutExtension: string): Promise<string> {
    return saveFileAs(page, 'dataflow', filenameWithoutExtension);
}
async function loadIncludeSpecification(page: Page) {
    const fileChooser = await openFileChooser(page, 'specification');
    const specificationName = 'sample-include-specification.json';
    const specification = await fs.readFile(getPathToJsonFile(specificationName), { encoding: 'utf-8' });
    const newSpecification = specification.replaceAll(
        'https://raw.githubusercontent.com/antmicro/kenning-pipeline-manager/main/examples/',
        `http://localhost:7001/`,
    );
    const newSpecificationPath = temporaryDir + specificationName;
    await fs.writeFile(newSpecificationPath, newSpecification);
    await fileChooser.setFiles(newSpecificationPath);
}
async function loadSpecificationFromFile(page: Page, specificationFile: string) {
    const fileChooser = await openFileChooser(page, 'specification');
    await fileChooser.setFiles(specificationFile);
}
async function loadDatflowFromFile(page: Page, dataflowFile: string) {
    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(dataflowFile);
}
const examples = [
    { specification: 'sample-specification.json', dataflow: 'sample-dataflow.json' },
    { specification: 'sample-include-specification.json', dataflow: 'sample-include-dataflow.json' },
    { specification: 'sample-include-subgraph-specification.json', dataflow: 'sample-include-subgraph-dataflow.json' },
    { specification: 'sample-inheritance-specification.json', dataflow: 'sample-inheritance-dataflow.json' },
    { specification: 'sample-inout-specification.json', dataflow: 'sample-inout-dataflow.json' },
    { specification: 'sample-interface-groups-specification.json', dataflow: 'sample-interface-groups-dataflow.json' },
    { specification: 'sample-loopback-specification.json', dataflow: 'sample-loopback-dataflow.json' },
    { specification: 'sample-multiple-io-specification.json', dataflow: 'sample-multiple-io-dataflow.json' },
    { specification: 'sample-subgraph-specification.json', dataflow: 'sample-subgraph-dataflow.json' },
    { specification: 'sample-related-graph-specification.json', dataflow: undefined },
    { specification: 'sample-dynamic-interfaces-specification.json', dataflow: 'sample-dynamic-interfaces-dataflow.json' },
];
async function openNodePalette(page: Page) {
    // Assert that node types can be added.
    await page.locator('div').filter({ hasText: /^Show node browser$/ }).first().click();
}
examples.forEach(({ dataflow, specification }) => {
    test(`save and load ${specification}`, async ({ page }) => {
        await page.goto(getUrl());
        if (specification === 'sample-include-specification.json') {
            await loadIncludeSpecification(page);
        } else {
            await loadSpecification(page, specification);
        }
        await openNodePalette(page);
        await expectNoErrors(page);
        const filepath = await saveSpecificationAs(page, 'temp');
        await expectNoErrors(page);
        await loadSpecificationFromFile(page, filepath);
        await expectNoErrors(page);
    });
    if (dataflow === undefined) {
        return;
    }
    test(`loading ${dataflow}, ${specification}`, async ({ page }) => {
        await page.goto(getUrl());
        await loadSpecification(page, specification);
        await expectNoErrors(page);
        await loadDataflow(page, dataflow);
        await expectNoErrors(page);
    });
    test(`save and load ${dataflow} using ${specification}`, async ({ page }) => {
        await page.goto(getUrl());
        await loadSpecification(page, specification);
        await expectNoErrors(page);
        await loadDataflow(page, dataflow);
        await expectNoErrors(page);
        const filepath = await saveDataflowAs(page, 'temp');
        await expectNoErrors(page);
        await loadDatflowFromFile(page, filepath);
        await expectNoErrors(page);
    });
});
