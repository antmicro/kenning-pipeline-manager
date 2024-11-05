import { test, expect } from '@playwright/test';
import { getUrl } from './config';

// sample-dataflow.json and sample-specification.json from GitHub of KPM.
const SAMPLE_DATAFLOW = `${getUrl()}/?spec=https%3A%2F%2Fraw.githubusercontent.com%2Fantmicro%2Fkenning-pipeline-manager%2Fmain%2Fexamples%2Fsample-specification.json&graph=https%3A%2F%2Fraw.githubusercontent.com%2Fantmicro%2Fkenning-pipeline-manager%2Fmain%2Fexamples%2Fsample-dataflow.json`;


test('has title', async ({ page }) => {
  await page.goto(SAMPLE_DATAFLOW);
  expect(await page.title()).toBe('Pipeline Manager');
});


test('remove node', async ({ page }) => {
  // Load a website and wait until nodes are loaded.
  await page.goto(SAMPLE_DATAFLOW);
  const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
  await page.waitForSelector(`#${loadVideoNodeId}`);

  // Find the node and invoke a context menu with a right click.
  const loadVideoNode = await page.locator(`#${loadVideoNodeId}`);
  expect(loadVideoNode.isVisible());
  await loadVideoNode.click({
    button: 'right'
  });

  // Delete the node.
  const deleteButton = await page.getByText('Delete');
  await deleteButton.click();

  // Verify that the node has disappeared.
  expect(await page.locator(`#${loadVideoNodeId}`).isVisible() === false);
});


test('show menu by right-clicking on node', async ({ page }) => {
  // Load a website and wait until nodes are loaded.
  await page.goto(SAMPLE_DATAFLOW);
  const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
  await page.waitForSelector(`#${loadVideoNodeId}`);
  const node = await page.locator(`#${loadVideoNodeId}`);

  // Right-click on the node's title.
  const nodeTitle = await node.locator('.__title');
  await nodeTitle.click({ button: 'right' });
  let menu = await page.locator('.baklava-context-menu');
  expect(await page.locator('.baklava-context-menu').isVisible());
  expect(await menu.filter({ hasText: 'Details' }).count());


  // Close the context menu.
  await page.mouse.click(200, 0);

  // Right-click on the node's content.
  const nodeBody = await node.locator('.__content');
  await nodeBody.click({ button: 'right' });
  menu = await page.locator('.baklava-context-menu');
  expect(await menu.isVisible());
  expect(await menu.filter({ hasText: 'Details' }).count());
});


test('show menu by right-clicking on interface', async ({ page }) => {
  // Load a website.
  await page.goto(SAMPLE_DATAFLOW);
  const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
  await page.waitForSelector(`#${loadVideoNodeId}`);
  const node = await page.locator(`#${loadVideoNodeId}`);

  // Right-click on a node.
  const nodeInterface = await node.getByText('frames');
  await nodeInterface.click({ button: 'right' });

  // Verify presence and content of a context menu.
  const menu = await page.locator('.baklava-context-menu');
  expect(await menu.isVisible());
  expect(await menu.filter({ hasText: 'Expose Interface' }).count());
});
