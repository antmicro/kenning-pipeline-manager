import os from 'os';
import {
    test, expect, Page,
} from '@playwright/test';
import {
    getUrl, loadSpecification, loadDataflow, openFileChooser,
} from './config.js';

const temporaryDir = `${os.tmpdir()}/`;

async function expectNoErrors(page: Page) {
    const notifications = page.locator('.notifications > .panel > ul > *:not(:has(.info))');
    const c = await notifications.count();
    if (c !== 0) {
        await page.locator('#navbar-bell').click();
        await page.locator('.tab-item').click();
        await page.waitForTimeout(3000);
    }
    expect(c).toBe(0);
}
async function saveFileAs(
    page: Page,
    purpose: string,
    filenameWithoutExtension: string,
): Promise<string> {
    const text = purpose === 'specification' ? 'Save specification as...' : 'Save graph as file as...';
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
async function loadSpecificationFromFile(page: Page, specificationFile: string) {
    const fileChooser = await openFileChooser(page, 'specification');
    await fileChooser.setFiles(specificationFile);
}
async function loadDatflowFromFile(page: Page, dataflowFile: string) {
    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(dataflowFile);
}
const examples = [
    { dataflow: 'sample-dataflow.json', specification: 'sample-specification.json' },
    { dataflow: 'sample-include-dataflow.json', specification: 'sample-include-specification.json' },
    { dataflow: 'sample-include-subgraph-dataflow.json', specification: 'sample-include-subgraph-specification.json' },
    { dataflow: 'sample-inheritance-dataflow.json', specification: 'sample-inheritance-specification.json' },
    { dataflow: 'sample-inout-dataflow.json', specification: 'sample-inout-specification.json' },
    { dataflow: 'sample-interface-groups-dataflow.json', specification: 'sample-interface-groups-specification.json' },
    { dataflow: 'sample-loopback-dataflow.json', specification: 'sample-loopback-specification.json' },
    { dataflow: 'sample-multiple-io-dataflow.json', specification: 'sample-multiple-io-specification.json' },
    { dataflow: 'sample-subgraph-dataflow.json', specification: 'sample-subgraph-specification.json' },
    { dataflow: '', specification: 'sample-related-graph-specification.json' },
    // { dataflow: 'sample-dynamic-interfaces-dataflow.json', specification: 'sample-dynamic-interfaces-specification.json' },
];
examples.forEach(({ dataflow, specification }) => {
    test(`loading ${dataflow}, ${specification}`, async ({ page }) => {
        await page.goto(getUrl());
        // eslint-disable-next-line no-restricted-syntax
        await loadSpecification(page, specification);
        await expectNoErrors(page);
        if (dataflow !== '') {
            await loadDataflow(page, dataflow);
            await expectNoErrors(page);
        }
    });
    test(`save and load ${specification}`, async ({ page }) => {
        test.fixme(true, 'Saving and loading is unstable');
        await page.goto(getUrl());
        // eslint-disable-next-line no-restricted-syntax
        await loadSpecification(page, specification);
        await expectNoErrors(page);
        const filepath = await saveSpecificationAs(page, 'temp');
        await expectNoErrors(page);
        await loadSpecificationFromFile(page, filepath);
        await expectNoErrors(page);
    });
    test(`save and load ${dataflow} using ${specification}`, async ({ page }) => {
        test.fixme(true, 'Saving and loading is unstable');
        if (dataflow === '') {
            test.skip(() => true, 'no dataflow');
        }
        await page.goto(getUrl());
        await loadSpecification(page, specification);
        await expectNoErrors(page);
        await loadDataflow(page, dataflow);
        await expectNoErrors(page);
        const filepath = await saveDataflowAs(page, 'temp');
        await loadDatflowFromFile(page, filepath);
        await expectNoErrors(page);
    });
});
