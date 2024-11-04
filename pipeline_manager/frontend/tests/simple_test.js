import { chromium } from 'playwright';

(async () => {
    // Launch a new browser instance
    const browser = await chromium.launch();
    // Create a new page
    const page = await browser.newPage();
    // Navigate to a website
    await page.goto('https://example.com');
    // Print the title of the page
    console.log(await page.title());
    // Close the browser
    await browser.close();
})();
