import fs from 'fs/promises';
import {
    test, expect, Page,
} from '@playwright/test';
import { readFileSync } from 'node:fs';
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
    if (count !== 0) {
        await page.locator('.tab').getByText('Terminal').click();
        await page.waitForTimeout(2000);
    }
    expect(count).toBe(0);
}

async function deepCleanEditor(page: Page) {
    const settings = page.locator('.settings-panel');
    expect(settings).toBeVisible();
    await settings.hover({ force: true });

    const button = page.getByText('Clean editor');
    expect(button).toBeVisible();
    await button.dispatchEvent('click');
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

async function loadIncludeSpecification(testInfo) {
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
    return newSpecificationPath;
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
    { specification: 'sample-rectangle-grouping-specification.json', dataflow: 'sample-rectangle-grouping-dataflow.json' },
];

async function dragAndDropFile(page: Page, selector: string, fileName: string, testInfo) {
    const filePath = getPathToJsonFile(fileName);
    const buffer = readFileSync(filePath).toString('base64');

    const dataTransfer = await page.evaluateHandle(
        async ({ bufferData, localFileName, localFileType }) => {
            const dt = new DataTransfer();
            const blobData = await fetch(bufferData).then((res) => res.blob());
            const file = new File([blobData],
                localFileName,
                { type: localFileType },
            );
            dt.items.add(file);
            return dt;
        },
        {
            bufferData: `data:application/octet-stream;base64,${buffer}`,
            localFileName: testInfo.outputPath(fileName.substring(0, fileName.indexOf('.'))),
            localFileType: 'json',
        },
    );

    await page.waitForSelector(selector);
    await page.dispatchEvent(selector, 'drop', { dataTransfer });
    await page.waitForSelector('.loading-screen', { state: 'hidden' });

    const bufferStr = readFileSync(filePath, 'utf8');
    const data = JSON.parse(bufferStr);
    if (data.entryGraph !== undefined) {
        return false;
    }
    return true;
}

examples.forEach(({ dataflow, specification }) => {
    test(`save and load ${specification}`, async ({ page }, testInfo) => {
        await page.goto(getUrl());
        if (specification === 'sample-include-specification.json') {
            const newSpecificationPath = await loadIncludeSpecification(testInfo);
            const fileChooser = await openFileChooser(page, 'specification');
            await fileChooser.setFiles(newSpecificationPath);
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

    test(`context loading ${dataflow}, ${specification}`, async ({ page }) => {
        await page.goto(getUrl());
        await loadSpecification(page, specification);
        await expectNoErrors(page);
        await loadDataflow(page, dataflow);
        await expectNoErrors(page);
    });
    test(`drag and drop welcome ${dataflow}, ${specification}`, async ({ page }, testInfo) => {
        await page.goto(getUrl());
        await deepCleanEditor(page);
        const continueProcessing = await dragAndDropFile(page, '.welcome-container', specification, testInfo);
        await expectNoErrors(page);
        if (!continueProcessing) {
            return;
        }
        await dragAndDropFile(page, '.welcome-container', dataflow, testInfo);
        await expectNoErrors(page);
    });

    test(`drag and drop canvas ${dataflow}, ${specification}`, async ({ page }, testInfo) => {
        await page.goto(getUrl());
        await deepCleanEditor(page);
        await dragAndDropFile(page, '.baklava-editor', specification, testInfo);
        await expectNoErrors(page);
        await dragAndDropFile(page, '.baklava-editor', dataflow, testInfo);
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
