import {
    test, expect, Page,
} from '@playwright/test';
import {
    getUrl,
    loadSpecification,
    loadDataflow,
} from './config.js';

async function expectNoErrors(page: Page) {
    const loading = page.locator('.loading-screen');
    await loading.waitFor({ state: 'hidden' });
    await expect(loading).not.toBeVisible();
    const notifications = page.locator(
        '.notifications > .panel > ul > *:not(:has(.info))',
    );
    const count = await notifications.count();
    expect(count).toBe(0);
}

test('Autolayout test', async ({ page }) => {
    await page.goto(getUrl());

    await loadSpecification(page, 'sample-network-specification.json');
    await expectNoErrors(page);
    await loadDataflow(page, 'sample-network-dataflow.json');
    await expectNoErrors(page);

    const elements = await page.locator('.baklava-node').all();

    // If the autolayout is not triggered all the nodes are stacked on top of each other.
    const differ = (await Promise.all(elements.map((li) => li.boundingBox())))
        .filter((bb) => bb !== null)
        .some((bb, _, boxes) => bb.x !== boxes[0].x || bb.y !== boxes[0].y);
    expect(differ).toBe(true);
});
