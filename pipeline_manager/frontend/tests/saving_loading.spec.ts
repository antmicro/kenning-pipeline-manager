import fs from 'fs/promises';
import {
    test, expect, Page,
} from '@playwright/test';
import {
    getUrl,
    loadSpecification,
    loadDataflow,
    openFileChooser,
    getPathToJsonFile,
} from './config.js';

async function expectNoErrors(page: Page) {
    const notifications = page.locator(
        '.notifications > .panel > ul > *:not(:has(.info))',
    );
    const count = await notifications.count();
    expect(count).toBe(0);
}

async function saveFileAs(
    page: Page,
    testInfo,
    purpose: 'specification' | 'dataflow',
    filenameWithoutExtension: string,
): Promise<string> {
    const text = (purpose === 'specification' ? 'Save specification as...' : 'Save graph as file as...');
    const logo = page.locator('.logo');
    await logo.hover();

    await page.getByRole('button', { name: text }).click();

    const uniqueName = `${filenameWithoutExtension}-${testInfo.workerIndex}-${Date.now()}`;

    await page.getByPlaceholder('File name').first().fill(uniqueName);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save' }).click();
    const download = await downloadPromise;

    const filePath = testInfo.outputPath(download.suggestedFilename());
    await download.saveAs(filePath);

    return filePath;
}

async function saveSpecificationAs(page: Page, testInfo, filename: string) {
    return saveFileAs(page, testInfo, 'specification', filename);
}

async function saveDataflowAs(page: Page, testInfo, filename: string) {
    return saveFileAs(page, testInfo, 'dataflow', filename);
}

async function loadIncludeSpecification(page: Page, testInfo) {
    const fileChooser = await openFileChooser(page, 'specification');
    const specificationName = 'sample-include-specification.json';
    const specification = await fs.readFile(
        getPathToJsonFile(specificationName),
        { encoding: 'utf-8' },
    );
    const newSpecification = specification.replaceAll(
        'https://raw.githubusercontent.com/antmicro/kenning-pipeline-manager/main/examples/',
        'http://localhost:7001/',
    );
    const newSpecificationPath = testInfo.outputPath(specificationName);
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

examples.forEach(({ dataflow, specification }) => {
    test(`save and load ${specification}`, async ({ page }, testInfo) => {
        await page.goto(getUrl());
        if (specification === 'sample-include-specification.json') {
            await loadIncludeSpecification(page, testInfo);
        } else {
            await loadSpecification(page, specification);
        }
        await expectNoErrors(page);
        const filepath = await saveSpecificationAs(page, testInfo, 'temp');
        await expectNoErrors(page);
        await loadSpecificationFromFile(page, filepath);
        await expectNoErrors(page);
    });

    if (!dataflow) return;

    test(`loading ${dataflow}, ${specification}`, async ({ page }) => {
        await page.goto(getUrl());
        await loadSpecification(page, specification);
        await expectNoErrors(page);
        await loadDataflow(page, dataflow);
        await expectNoErrors(page);
    });

    test(`save and load ${dataflow} using ${specification}`, async ({ page }, testInfo) => {
        await page.goto(getUrl());
        await loadSpecification(page, specification);
        await expectNoErrors(page);
        await loadDataflow(page, dataflow);
        await expectNoErrors(page);
        const filepath = await saveDataflowAs(page, testInfo, 'temp');
        await expectNoErrors(page);
        await loadDatflowFromFile(page, filepath);
        await expectNoErrors(page);
    });
});
