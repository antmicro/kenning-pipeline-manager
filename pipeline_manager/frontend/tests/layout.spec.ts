import { test, expect } from '@playwright/test';
import {
    getUrl,
    loadSpecification,
    loadDataflow,
    openFileChooser,
    getPathToJsonFile,
    enableNavigationBar,
    expectNoErrors,
    saveFileAs
} from './config.js';

test('export and import layout',async ({page},testInfo) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-views-specification.json');
    await loadDataflow(page, 'sample-views-dataflow.json');
    // save current layout
    const filePath = await saveFileAs(page,testInfo,'layout','layout');
    // load current layout
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.mouse.move(25, 25);
    await page.getByText("Load layout").click();
    const fileChooser = (await fileChooserPromise).setFiles(filePath);

    await expectNoErrors(page);
});