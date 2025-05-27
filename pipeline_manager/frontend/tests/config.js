// Configuration file with the default configuration for playwright tests.
// @ts-check
import { fileURLToPath } from 'url';
import path, { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration for path and directory of static HTML-based version of the frontend.
const config = {
    directory: './dist',
    file: 'index.html',
    directoryWithJsonFile: path.join(__dirname, '../../../examples'),
};

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

export const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';

export async function enableNavigationBar(page) {
    await page.mouse.move(500, 0);
    await page
        .locator('.hoverbox')
        .filter({ hasText: /^Show node browser$/ })
        .first()
        .click();
}

export async function addNode(page, category, nodeName, x, y) {
    const categoryBar = page.getByText(category);
    const node = page.getByText(nodeName).first();

    // Open a proper category.
    await enableNavigationBar(page);
    await categoryBar.click();

    // Drag and drop to the [x, y] position.
    await dragAndDrop(page, node, x, y);
}

export async function dragAndDrop(page, locator, x, y) {
    await locator.hover();
    await page.mouse.down();
    await page.mouse.move(x, y);
    await page.mouse.up();
}
