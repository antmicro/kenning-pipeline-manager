// Configuration file with the default configuration for playwright tests.
// @ts-check
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path and directory to a static HTML-based version of the frontend.
export const config = {
    directory: 'dist',
    file: 'index.html',
};

/**
 * Get an URL of the main Kenning Pipeline Manager page based on the configuration.
 * @returns {string} URL of the main page.
 */
export function getUrl() {
    return `file://${join(__dirname, `../${config.directory}/${config.file}`)}`;
}

export const loadVideoNodeId = 'f50b4f2a-a2e2-4409-a5c9-891a8de44a5b';
