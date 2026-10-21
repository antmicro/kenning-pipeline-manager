import { test, expect, type Page } from '@playwright/test';
import {
    getUrl, loadSpecification, loadDataflow, AddConnection, getContextMenu, expectNoErrors,
} from './config.js';

const generatorId = 'a1b2c3d4-1111-4000-8000-000000000001';
const consumerId = 'a1b2c3d4-3333-4000-8000-000000000001';

const subInterfaceNames = ['red', 'green', 'blue'];

async function loadCompositeGraph(page: Page) {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-composite-specification.json');
    await loadDataflow(page, 'sample-composite-dataflow.json');
    await expect(page.locator(`#${generatorId}`)).toBeVisible();
    await expect(page.locator(`#${consumerId}`)).toBeVisible();
}

test('composite interfaces are rendered collapsed by default', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    const consumer = page.locator(`#${consumerId}`);

    await expect(generator.locator('.__port_composite')).toHaveCount(1);
    await expect(consumer.locator('.__port_composite')).toHaveCount(1);
    await expect(
        generator.locator('.__port:not(.__port_composite_port)'),
    ).toHaveCount(1);
    await expect(generator.locator('.--composite-sub')).toHaveCount(0);
    await expect(consumer.locator('.--composite-sub')).toHaveCount(0);

    await expectNoErrors(page);
});

test('unrolling a composite interface hides its port and renders the sub-interfaces', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    await generator.locator('.__port_composite_toggle').click();

    await expect(generator.locator('.__port_composite_port_hidden')).toHaveCount(1);

    const subRows = generator.locator('.--composite-sub');
    await expect(subRows).toHaveCount(subInterfaceNames.length);
    // eslint-disable-next-line no-restricted-syntax
    for (const name of subInterfaceNames) {
        // eslint-disable-next-line no-await-in-loop
        await expect(generator.locator(`.--composite-sub:has-text("${name}")`)).toHaveCount(1);
    }

    await generator.locator('.__port_composite_toggle').click();
    await expect(generator.locator('.__port_composite_port_hidden')).toHaveCount(0);
    await expect(generator.locator('.--composite-sub')).toHaveCount(0);

    await generator.locator('.__port_composite_toggle').click();
    await expectNoErrors(page);
});

test('collapsing keeps sub-interface connections on the composite port', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    const connections = page.locator('.custom-connections-container > g');
    await expect(connections).toHaveCount(1);

    await generator.locator('.__port_composite_toggle').click();
    const redRow = generator.locator('.--composite-sub', { hasText: 'red' });
    const monitorPort = page.locator(
        `#${consumerId} .__port:not(.__port_composite_port)`,
    );
    await AddConnection(page, redRow.locator('.__port'), monitorPort);
    await expect(connections).toHaveCount(2);
    await expect(redRow).toHaveClass(/--connected/);

    await generator.locator('.__port_composite_toggle').click();
    await expect(connections).toHaveCount(2);

    await generator.locator('.__port_composite_toggle').click();
    await expect(
        generator.locator('.--composite-sub', { hasText: 'red' }),
    ).toHaveClass(/--connected/);

    await expectNoErrors(page);
});

test('connections held by unrolled sub-ports are removed with the node', async ({ page }) => {
    await loadCompositeGraph(page);

    const generator = page.locator(`#${generatorId}`);
    const connections = page.locator('.custom-connections-container > g');

    await generator.locator('.__port_composite_toggle').click();
    const redRow = generator.locator('.--composite-sub', { hasText: 'red' });
    const monitorPort = page.locator(
        `#${consumerId} .__port:not(.__port_composite_port)`,
    );
    await AddConnection(page, redRow.locator('.__port'), monitorPort);
    await expect(connections).toHaveCount(2);

    await generator.locator('.__title').click({ button: 'right' });
    await getContextMenu(page).getByText('Delete').click({ force: true });
    await expect(connections).toHaveCount(0);

    await expectNoErrors(page);
});
