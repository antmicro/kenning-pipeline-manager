import {
    test, expect, Page, TestInfo,
} from '@playwright/test';
import { readFile, writeFile } from 'fs/promises';
import {
    getUrl, getPathToJsonFile, loadSpecification, openFileChooser, getNode,
} from './config.js';

async function loadModifiedDataflow(page: Page, testInfo: TestInfo, option: str) {
    const json = JSON.parse(await readFile(getPathToJsonFile('sample-dataflow.json'), 'utf-8'));
    json.metadata[option] = true;
    const outputPath = testInfo.outputPath('updated-sample-dataflow.json');
    await writeFile(outputPath, JSON.stringify(json, null, 2), 'utf-8');

    await page.goto(getUrl());
    await loadSpecification(page, 'sample-specification.json');
    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(outputPath);
}

async function modifyProperty(page: Page, option: str) {
    const gaussian = getNode(page, 'GaussianKernel');
    const sizeSection = gaussian.locator('.baklava-num-input').getByText('size').locator('..');
    const sizeVal = sizeSection.locator('.__value').first();
    expect(await sizeVal.innerText()).toBe('5');
    await sizeSection.locator('..').locator('.--dec').click();
    await page.mouse.click(200, 200);

    if (option === 'readonly') {
        // Expect property value to remain unchanged
        expect(await sizeVal.innerText()).toBe('5');
    } else {
        // Expect property value to change
        expect(await sizeVal.innerText()).toBe('4');
    }
}

test('readonly: modify property', async ({ page }, testInfo) => {
    await loadModifiedDataflow(page, testInfo, 'readonly');
    await modifyProperty(page, 'readonly');
});

test('predefined graph: modify property', async ({ page }, testInfo) => {
    await loadModifiedDataflow(page, testInfo, 'predefinedGraph');
    await modifyProperty(page, 'predefinedGraph');
});
