// Configuration file with the default configuration for playwright tests.
// @ts-check
import { fileURLToPath } from 'url';
import path, { dirname, join } from 'path';
import { expect } from 'playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration for path and directory of static HTML-based version of the frontend.
const config = {
    directory: './dist',
    file: 'index.html',
    directoryWithJsonFile: path.join(__dirname, '../../../examples'),
};

export const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';

/**
 * Get an URL of the main Kenning Pipeline Manager page based on the configuration.
 * @returns {string} URL of the main page.
 */
export function getUrl() {
    return `file://${join(__dirname, `../${config.directory}/${config.file}`)}`;
}

/**
 * Get the URL to either a dataflow or specification JSON file from `examples` directory.
 * @param {string} filename
 * @returns {string} Path to the JSON file.
 */
export function getPathToJsonFile(filename) {
    return path.join(config.directoryWithJsonFile, filename);
}

/**
 * Open the file chooser dialog for loading either a specification or dataflow file.
 * @param {import('@playwright/test').Page} page
 * @param {'specification' | 'dataflow'} purpose
 * @returns {Promise<import('@playwright/test').FileChooser>}
 */
export async function openFileChooser(page, purpose) {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.mouse.move(25, 25);
    const text = purpose === 'specification' ? 'Load specification' : 'Load graph file';
    await page.getByText(text).click();
    return await fileChooserPromise;
}

/**
 * Enable the navigation bar by simulating a mouse movement and clicking
 * on the element with the text "Show node browser".
 *
 * @async
 * @param {import('@playwright/test').Page} page - The Playwright Page object to interact with.
 * @returns {Promise<void>} Resolves when the navigation bar has been enabled.
 */
export async function enableNavigationBar(page) {
    await page.mouse.move(500, 0);
    await page
        .locator('.hoverbox')
        .filter({ hasText: /^Show node browser$/ })
        .first()
        .click();
}

/**
 * Add a node to the canvas by dragging it from the navigation bar.
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {string} category - The category name in the navigation bar.
 * @param {string} nodeName - The name of the node to add.
 * @param {number} x - The x-coordinate to drop the node.
 * @param {number} y - The y-coordinate to drop the node.
 * @returns {Promise<void>} Promise that resolves when the drag-and-drop operation is complete.
 */
export async function addNode(page, category, nodeName, x, y) {
    const categoryBar = page.getByText(category);
    const node = page.getByText(nodeName, { exact: true }).first();

    // Open a proper category.
    await enableNavigationBar(page);
    await categoryBar.scrollIntoViewIfNeeded();
    await expect(categoryBar).toBeVisible();
    await categoryBar.click();


    // Drag and drop to the [x, y] position.
    await dragAndDrop(page, node, x, y);
}

/**
 * Drag-and-drop operation on the specified locator element.
 *
 * @async
 * @param {import('playwright').Page} page - Playwright Page to perform actions on.
 * @param {import('playwright').Locator} locator - Locator of the element to drag.
 * @param {number} x - X-coordinate to move the mouse to (relative to the viewport).
 * @param {number} y - Y-coordinate to move the mouse to (relative to the viewport).
 * @returns {Promise<void>} Promise that resolves when the drag-and-drop operation is complete.
 */
export async function dragAndDrop(page, locator, x, y) {
    await locator.hover();
    await page.mouse.down();
    await page.mouse.move(x, y);
    await page.mouse.up();
}
