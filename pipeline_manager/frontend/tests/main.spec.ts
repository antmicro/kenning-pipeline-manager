import { test, expect } from '@playwright/test';
import { getUrl } from './config';

const SAMPLE_DATAFLOW = `${getUrl()}/?spec=https%3A%2F%2Fraw.githubusercontent.com%2Fantmicro%2Fkenning-pipeline-manager%2Fmain%2Fexamples%2Fsample-specification.json&graph=https%3A%2F%2Fraw.githubusercontent.com%2Fantmicro%2Fkenning-pipeline-manager%2Fmain%2Fexamples%2Fsample-dataflow.json`;


test('has title', async ({ page }) => {
  await page.goto(SAMPLE_DATAFLOW) // Default address
  expect(await page.title()).toBe('Pipeline Manager');
});


test('remove node', async ({ page }) => {
  await page.goto(SAMPLE_DATAFLOW)
  const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b'
  await page.waitForSelector(`#${loadVideoNodeId}`);

  const loadVideoNode = await page.locator(`#${loadVideoNodeId}`);
  expect(loadVideoNode.isVisible());


  loadVideoNode.click({
    button: 'right'
  });

  const deleteButton = await page.getByText('Delete');
  await deleteButton.click();

  expect(await page.locator(`#${loadVideoNodeId}`).isVisible() === false);
});
