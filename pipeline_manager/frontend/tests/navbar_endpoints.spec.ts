import { test, expect, Page } from "@playwright/test";
import { getUrl, loadSpecification, loadDataflow } from "./config.js";
import { callFrontendRPC } from "./utils/endpoints.js";

test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto(getUrl());
});

test("test notifications verbosity endpoints", async ({ page }) => {
    const data = await callFrontendRPC(page, "notifications_get_verbosity", {all: true});
    const possibleValues = data.result;

    expect(possibleValues?.length === 3).toBeTruthy();
    await page.getByLabel("settings").click();

    for (const value of possibleValues) {
        const response = await callFrontendRPC(page, "notifications_set_verbosity", {verbosity: value});
        expect(response?.error).toBeUndefined();

        const getVerbosity = await callFrontendRPC(page, "notifications_get_verbosity");
        expect(getVerbosity?.result?.verbosity).toBe(value);

        await expect(page.getByTitle("Verbosity of notifications")).toContainText(value);
    }
});

test("test connections style endpoints", async ({ page }) => {
    const data = await callFrontendRPC(page, "connections_get_style", {all: true});
    const possibleValues = data.result;

    expect(possibleValues?.length > 0).toBeTruthy();
    await page.getByLabel("settings").click();

    for (const value of possibleValues) {
        const response = await callFrontendRPC(page, "connections_set_style", {style: value});
        expect(response?.error).toBeUndefined();

        const getVerbosity = await callFrontendRPC(page, "connections_get_style");
        expect(getVerbosity?.result?.style).toBe(value);

        await expect(page.getByTitle("Connection style")).toContainText(value);
    }
});

test("test background grid size endpoints", async ({ page }) => {
    const data = await callFrontendRPC(page, "background_get_grid_size");
    const currentValue = data?.result?.size;
    expect(currentValue || currentValue === 0).toBeTruthy();

    const valueSelector = page
        .locator(".__content")
        .filter({ has: page.getByTitle("background grid size") })
        .locator(".__value");

    expect(valueSelector).toHaveText(currentValue.toString());

    await page.getByLabel("settings").click();
    for (let value = currentValue; value >= 30; value -= 30) {
        const response = await callFrontendRPC(page, "background_set_grid_size", { size: value });
        expect(response?.error).toBeUndefined();

        const getSize = await callFrontendRPC(page, "background_get_grid_size");
        expect(getSize?.result?.size).toBe(value);

        await expect(valueSelector).toHaveText(value.toString());

    }
});

test("test autolayout apply endpoint", async ({ page }) => {
    const nodes = await page.locator(".baklava-node").all();

    const positions = new Map<string, any>();

    for (const node of nodes) {
        const node_id = await node.getAttribute("id");
        const boundingBox = await node.boundingBox();
        if (node_id)
            positions.set(node_id, boundingBox);
    }

    const call = await callFrontendRPC(page, "autolayout_apply");
    expect(call?.error).toBeUndefined();

    let different = false;
    for (const node of nodes) {
        const node_id = await node.getAttribute("id");
        const boundingBox = await node.boundingBox();
        if (node_id === null) continue;
        const position = positions.get(node_id);
        if (JSON.stringify(position) !== JSON.stringify(boundingBox)) {
            different = true;
            break;
        }
    }

    expect(different).toBe(true);
});

test("test interfaces hiding endpoints", async ({ page }) => {
    await loadSpecification(page, 'sample-multiple-io-specification.json');
    await loadDataflow(page, 'sample-multiple-io-dataflow.json');
    await page.locator(".loading-screen").waitFor({ state: 'detached' });

    const portsInitial = await page.locator(".__port:visible").count();
    expect(portsInitial).not.toBe(0);

    const hideResponse = await callFrontendRPC(page, "interfaces_hide_unconnected");
    expect(hideResponse?.error).toBeUndefined();

    const portsHidden = await page.locator(".__port:visible").count();
    expect(portsHidden).toBeLessThan(portsInitial);

    const showResponse = await callFrontendRPC(page, "interfaces_show_hidden");
    expect(showResponse?.error).toBeUndefined();

    const portsFinal = await page.locator(".__port:visible").count();
    expect(portsFinal).toBe(portsInitial);
});


test("test editor clear endpoint", async ({ page }) => {
    const nodes = page.locator(".baklava-node");
    await expect(nodes).not.toHaveCount(0);

    const response = await callFrontendRPC(page, "editor_clear");
    expect(response?.error).toBeUndefined();

    await expect(nodes).toHaveCount(0);
});

test("test layers endpoints", async ({ page }) => {
    await page.getByLabel("settings").click();

    const listResponse = await callFrontendRPC(page, "layers_get_list");
    expect(listResponse?.error).toBeUndefined();
    const layerList = listResponse.result;
    expect(layerList.length).toBeTruthy();

    for (const layer of layerList) {
        const setResponse = await callFrontendRPC(page, "layer_set_hidden", {
            name: layer,
            hidden: true,
        });
        expect(setResponse?.error).toBeUndefined();

        const getResponse = await callFrontendRPC(page, "layer_get_hidden", { name: layer });
        expect(getResponse?.error).toBeUndefined();
        expect(getResponse.result.hidden).toBeTruthy();

        await expect(page.getByTitle(layer)).toHaveClass(/(^|\s)--checked(\s|$)/);

        const unsetResponse = await callFrontendRPC(page, "layer_set_hidden", {
            name: layer,
            hidden: false,
        });
        expect(unsetResponse?.error).toBeUndefined();

        const getUnsetResponse = await callFrontendRPC(page, "layer_get_hidden", { name: layer });
        expect(getUnsetResponse?.error).toBeUndefined();
        expect(getUnsetResponse.result.hidden).toBeFalsy();

        await expect(page.getByTitle(layer)).not.toHaveClass(/(^|\s)--checked(\s|$)/);
    }
});

test("test panel toggling endpoints", async ({ page }) => {
    // Close the node palette, which is open by default.
    await page.getByLabel("node-palette").click();

    const listResponse = await callFrontendRPC(page, "panel_toggle", { name: null });
    expect(listResponse?.error).toBeUndefined();
    const panelList = listResponse.result;
    expect(panelList.length).toBeTruthy();

    const panelSelectors: Record<string, string> = {
        notifications: ".notifications",
        palette: ".baklava-node-palette",
        settings: ".settings-panel",
    };

    for (const panel of panelList) {
        const selector = panelSelectors[panel];
        if (selector === undefined) {
            continue;
        }

        await expect(page.locator(selector)).not.toBeInViewport();

        const openResponse = await callFrontendRPC(page, "panel_toggle", { name: panel });
        expect(openResponse?.error).toBeUndefined();

        await expect(page.locator(selector)).toBeInViewport();

        const closeResponse = await callFrontendRPC(page, "panel_toggle", { name: panel });
        expect(closeResponse?.error).toBeUndefined();

        await expect(page.locator(selector)).not.toBeInViewport();
    }
});

test("test search query endpoints", async ({ page }) => {
    const query = "Video";

    const setResponse = await callFrontendRPC(page, "search_set_query", { query });
    expect(setResponse?.error).toBeUndefined();

    const getResponse = await callFrontendRPC(page, "search_get_query");
    expect(getResponse?.error).toBeUndefined();
    expect(getResponse.result.query).toBe(query);

    const totalNodes = await page.locator(".baklava-node").count();
    const highlightedNodes = await page.locator(".baklava-node:not(.--greyed-out)").count();
    const greyedOutNodes = await page.locator(".baklava-node.--greyed-out").count();
    expect(highlightedNodes).toBe(2);
    expect(greyedOutNodes).toBe(totalNodes - 2);
})
