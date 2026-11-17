import { test, expect } from '@playwright/test';
import {
    dragAndDrop, getNode, getNodeInterfaces, getUrl,
    loadSpecification, loadDataflow, openSettingsPanel,
} from './config.js';

async function setOption(page: Page, name: string) {
    openSettingsPanel(page);

    const checkbox = page.getByText(name);
    expect(checkbox).toBeVisible();
    await checkbox.dispatchEvent('click');
}

test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto(getUrl());
});

test('hide anchors', async ({ page }) => {
    await loadSpecification(page, 'sample-multiple-io-specification.json');
    await loadDataflow(page, 'sample-multiple-io-dataflow.json');

    const connection = page.locator('.custom-connections-container > g').first();
    const anchor = connection.locator('.anchor');
    await expect(anchor).toBeVisible();
    await setOption(page, 'Hide anchors');
    await expect(anchor).not.toBeVisible();
});

async function countInterfaces(page: Page, node: string, type: 'input' | 'output'): Promise<number> {
    return getNodeInterfaces(page, node, type).locator('.__port').count();
}

test('align interface sides', async ({ page }) => {
    await setOption(page, 'Align interface sides');

    await expect(await countInterfaces(page, 'LoadVideo', 'input')).toBe(0);
    await expect(await countInterfaces(page, 'LoadVideo', 'output')).toBe(1);
    await expect(await countInterfaces(page, 'Filter2D', 'input')).toBe(2);
    await expect(await countInterfaces(page, 'Filter2D', 'output')).toBe(1);

    const node = getNode(page, 'LoadVideo');
    const oldPosition = await node.boundingBox() ?? { x: 0, y: 0 };
    const newCoordinates = {
        x: oldPosition.x + 600,
        y: oldPosition.y,
    };
    await dragAndDrop(page, node.locator('.__title'), newCoordinates.x, newCoordinates.y);

    await expect(await countInterfaces(page, 'LoadVideo', 'input')).toBe(1);
    await expect(await countInterfaces(page, 'LoadVideo', 'output')).toBe(0);
    await expect(await countInterfaces(page, 'Filter2D', 'input')).toBe(1);
    await expect(await countInterfaces(page, 'Filter2D', 'output')).toBe(2);
});

test('show ids', async ({ page }) => {
    await setOption(page, 'Show IDs');
    const graphId = page.locator('.graphId');
    await expect(graphId).toBeVisible();
});

test('hide layers', async ({ page }) => {
    const node = getNode(page, 'LoadVideo');
    await expect(node).toBeVisible();
    await setOption(page, 'IOs');
    await expect(node).not.toBeVisible();
});
