// Configuration file with the default configuration for playwright.
// @ts-check

export const config = {
    protocol: 'http',
    address: '127.0.0.0',
    port: 8080,
}

/**
 * Get an URL of the main Kenning Pipeline Manager page based on the configuration.
 * @returns {string} URL of the main page.
 */
export function getUrl() {
    return `${config.protocol}://${config.address}:${config.port}`;
}