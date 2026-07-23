import { test, expect } from '@playwright/test';
import {
    getUrl,
    loadSpecification,
    loadDataflow,
    openFileChooser,
    getPathToJsonFile,
    enableNavigationBar,
    expectNoErrors,
    saveFileAs,
    openSettingsPanel,
    getNode,
    assertInputCount,
    assertOutputCount
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

test('preserve changes across views',async ({page},testInfo) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-views-specification.json');
    await loadDataflow(page, 'sample-views-dataflow.json');

    await openSettingsPanel(page);

    const selectedView = await page.getByTitle('Selected view');
    await selectedView.click();
    const dropdown = await selectedView.locator('.__dropdown');

    await dropdown.getByText('tree').click({ force: true });

    const node = await getNode(page,'Source').first();

    const outputInf = node.locator('.__interfaces .__outputs .__port').first();
    await outputInf.dblclick();

    await assertInputCount(node,1);
    await assertOutputCount(node,0);

    // save dataflow with views
    const dataflowWithViews = await saveFileAs(page, testInfo, 'dataflow');
    // load dataflow with virws
    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(dataflowWithViews);

    await openSettingsPanel(page);

    await selectedView.click();
    await dropdown.getByText('tree').click({ force: true });

    await assertInputCount(node,1);
    await assertOutputCount(node,0);
});