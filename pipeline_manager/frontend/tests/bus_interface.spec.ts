import {
    test, expect,
} from '@playwright/test';

import {
    loadSpecification, loadDataflow, getUrl,
} from './config.js';

test('check bus connections', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-bus-specification.json');
    await loadDataflow(page, 'sample-bus-dataflow.json');

    const connections = await page.locator('.custom-connections-container > g');
    expect(await connections.count()).toBe(9);
});
