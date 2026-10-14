import { test as base, expect } from "@playwright/test";
import { getUrl } from "./config.js";

import sampleSpecification from "../../../examples/sample-specification.json" with { type: "json" };
import sampleDataflow from "../../../examples/sample-dataflow.json" with { type: "json" };

import sampleMultipleIoSpecification from "../../../examples/sample-multiple-io-specification.json" with { type: "json" };
import sampleMultipleIoDataflow from "../../../examples/sample-multiple-io-dataflow.json" with { type: "json" };

const test = base.extend<{
    pmId: string,
    sendMessage:  (Any) => Promise<void>
    receiveMessage: (Any) => Promise<void>
    loadSpecification: (string) => Promise<void>
    loadDataflow: (string) => Promise<void>
}>({
    page: async ({ page, pmId }, use) => {
        await page.setContent(`<iframe id="${pmId}" name="${pmId}" src="${getUrl()}" style="width: 80%; height: 80%"></iframe>`, { waitUntil: "load" });

        use(page);
    },
    pmId: ["pm", { option: true }],
    sendMessage: async ({ page, pmId }, use) => {
        const sendMessage = async (data) => {
            await page.evaluate(([data, targetOrigin, pmId]) => {
                document.getElementById(pmId).contentWindow.postMessage(data, targetOrigin);
            }, [data, getUrl(), pmId]);
        };

        await use(sendMessage);
    },
    receiveMessage: async ({ page }, use) => {
        const receiveMessage = async (callback) => {
            await page.exposeFunction("messageCallback", callback)
            await page.evaluate(() => {
                window.addEventListener("message", async (event) => {
                    const data = event.data;
                    await window.messageCallback(data);
                });
            });
        };

        await use(receiveMessage);
    },

    loadSpecification: async ({ sendMessage }, use) => {
        const loadSpecification = async (specification) => {
            await sendMessage({
                method: "specification_change",
                params: {
                    specification: specification
                }
            });
        };
        await use(loadSpecification);
    },

    loadDataflow: async ({ sendMessage }, use) => {
        const loadDataflow = async (dataflow) => {
            await sendMessage({
                method: "graph_change",
                params: {
                    dataflow: dataflow
                }
            });
        };
        await use(loadDataflow);
    },

})

test.beforeEach(async ({sendMessage, loadSpecification, loadDataflow}) => {
        await sendMessage({
            method: "register_external_frontend"
        });

        await loadSpecification(sampleSpecification);
        await loadDataflow(sampleDataflow);
});

test("test notifications verbosity endpoints", async ({ page, pmId, sendMessage, receiveMessage }) => {
    const frameLocator = page.frameLocator("#" + pmId);

    let possibleValues = null;
    let currentValue = null;

    await receiveMessage(async (data) => {
        if (data.id === "possibleValues") {
            possibleValues = data.result;
        } else if (data.id === "currentValue") {
            currentValue = data.result.verbosity;
        }
    })

    await frameLocator.getByLabel("settings").click();

    await sendMessage({
        id: "possibleValues",
        method: "notifications_get_verbosity",
        params: {
            all: true,
        }
    });

    await expect(async () => {
        await expect(possibleValues).not.toBeNull();
    }).toPass();

    await expect(possibleValues.length).toBeTruthy();

    for (const value of possibleValues) {
        await sendMessage({
            method: "notifications_set_verbosity",
            params: {
                verbosity: value,
            }
        });

        await sendMessage({
            id: "currentValue",
            method: "notifications_get_verbosity",
            params: {}
        });

        await expect(async () => {
            await expect(currentValue).toBe(value);
        }).toPass();

        await expect(frameLocator.getByTitle("Verbosity of notifications")).toContainText(value);
    }
})

test("test connections style endpoints", async ({ page, pmId, sendMessage, receiveMessage }) => {
    const frameLocator = page.frameLocator("#" + pmId);

    let possibleValues = null;
    let currentValue = null;

    await receiveMessage(async (data) => {
        if (data.id === "possibleValues") {
            possibleValues = data.result;
        } else if (data.id === "currentValue") {
            currentValue = data.result.style;
        }
    })

    await frameLocator.getByLabel("settings").click();

    await sendMessage({
        id: "possibleValues",
        method: "connections_get_style",
        params: {
            all: true,
        }
    });

    await expect(async () => {
        await expect(possibleValues).not.toBeNull();
    }).toPass();

    await expect(possibleValues.length).toBeTruthy();

    for (const value of possibleValues) {
        await sendMessage({
            method: "connections_set_style",
            params: {
                style: value,
            }
        });

        await sendMessage({
            id: "currentValue",
            method: "connections_get_style",
        });

        await expect(async () => {
            await expect(currentValue).toBe(value);
        }).toPass();

        await expect(frameLocator.getByTitle("Connection style")).toContainText(value);
    }
})

test("test background grid size endpoints", async ({ page, pmId, sendMessage, receiveMessage }) => {
    const frameLocator = page.frameLocator("#" + pmId);

    let currentValue = null;

    await receiveMessage(async (data) => {
        if (data.id === "currentValue") {
            currentValue = data.result.size;
        }
    })

    await frameLocator.getByLabel("settings").click();

    await sendMessage({
        id: "currentValue",
        method: "background_get_grid_size",
    });

    await expect(async () => {
        await expect(currentValue).not.toBeNull();
    }).toPass();

    const valueSelector = await frameLocator
        .locator(".__content")
        .filter({ has: page.getByTitle("background grid size") })
        .locator(".__value")

    await expect(async () => {
        await expect(valueSelector).toHaveText(currentValue.toString());
    }).toPass();

    for (let value = currentValue; value >= 50; value -= 50) {
        await sendMessage({
            method: "background_set_grid_size",
            params: {
                size: value,
            }
        });

        await sendMessage({
            id: "currentValue",
            method: "background_get_grid_size",
        });

        await expect(async () => {
            await expect(currentValue).toBe(value);
        }).toPass();

        await expect(valueSelector).toHaveText(value.toString());

    }
});

test("test autolayout apply endpoint", async ({ page, pmId, sendMessage }) => {
    const frameLocator = page.frameLocator("#" + pmId);

    const nodes = await frameLocator.locator(".baklava-node").all();

    const positions = new Map<string, Any>();

    for (const node of nodes) {
        const node_id = await node.getAttribute("node-id");
        const boundingBox = await node.boundingBox();
        positions.set(node_id, boundingBox);
    }

    await sendMessage({
        method: "autolayout_trigger",
    })

    let different = false;
    for (const node of nodes) {
        const node_id = await node.getAttribute("node-id");
        const boundingBox = await node.boundingBox();
        const position = positions.get(node_id);
        if (JSON.stringify(position) !== JSON.stringify(boundingBox)) {
            different = true;
        }
    }

    await expect(different).toBe(true);
});

test("test interfaces hiding endpoints", async ({ page, pmId, sendMessage, loadSpecification, loadDataflow }) => {
    await loadSpecification(sampleMultipleIoSpecification);
    await loadDataflow(sampleMultipleIoDataflow);

    const frameLocator = page.frameLocator("#" + pmId);

    const portsInitial = await frameLocator.locator(".__port:visible").count();
    await expect(portsInitial).not.toBe(0);

    await sendMessage({
        method: "interfaces_hide_unconnected"
    })

    const portsHidden = await frameLocator.locator(".__port:visible").count();
    await expect(portsHidden).toBeLessThan(portsInitial);

    await sendMessage({
        method: "interfaces_show_hidden"
    })

    const portsFinal = await frameLocator.locator(".__port:visible").count();
    await expect(portsFinal).toBe(portsInitial);
});


test("test editor clear endpoint", async ({ page, pmId, sendMessage }) => {
    const frameLocator = page.frameLocator("#" + pmId);

    const nodes = await frameLocator.locator(".baklava-node");
    await expect(nodes).not.toHaveCount(0);

    await sendMessage({
        method: "editor_clear",
    })

    await expect(nodes).toHaveCount(0);
});

test("test layers endpoints", async ({ page, pmId, sendMessage, receiveMessage }) => {
    const frameLocator = page.frameLocator("#" + pmId);

    await frameLocator.getByLabel("settings").click();

    let layerList = null;
    let currentValue = null;

    await receiveMessage(async (data) => {
        if (data.id === "layerList") {
            layerList = data.result;
        } else if (data.id === "currentValue") {
            currentValue = data.result.hidden;
        }
    })

    await sendMessage({
        id: "layerList",
        method: "layers_get_list",
    })

    await expect(async () => {
        await expect(layerList).not.toBeNull();
        await expect(layerList.length).toBeTruthy();
    }).toPass();

    for (const layer of layerList) {
        await sendMessage({
            method: "layer_set_hidden",
            params: {
                name: layer,
                hidden: true,
            },
        })

        await sendMessage({
            id: "currentValue",
            method: "layer_get_hidden",
        });

        expect(async () => {
            await expect(currentValue).toBeTruthy()
        }).toPass();

        await expect(frameLocator.getByTitle(layer)).toHaveClass(/(^|\s)--checked(\s|$)/);

        await sendMessage({
            method: "layer_set_hidden",
            params: {
                name: layer,
                hidden: false,
            },
        })

        await sendMessage({
            id: "currentValue",
            method: "layer_get_hidden",
            params: {
                name: layer,
            },
        })

        expect(async () => {
            await expect(currentValue).toBeFalsy()
        }).toPass();

        await expect(frameLocator.getByTitle(layer)).not.toHaveClass(/(^|\s)--checked(\s|$)/);
    }
});

test("test panel toggling endpoints", async ({ page, pmId, sendMessage, receiveMessage }) => {
    const frameLocator = page.frameLocator("#" + pmId);

    await frameLocator.getByLabel("node-palette").click();

    let panelList = null;

    await receiveMessage(async (data) => {
        if (data.id === "panelList") {
            panelList = data.result;
        }
    })

    await sendMessage({
        id: "panelList",
        method: "panel_toggle",
        params: {
            name: null,
        },
    })

    await expect(async () => {
        await expect(panelList).not.toBeNull();
        await expect(panelList.length).toBeTruthy();
    }).toPass();

    const panelSelectors = new Map([
        ["notifications", ".notifications"],
        ["palette", ".baklava-node-palette"],
        ["settings", ".settings-panel"]
    ])

    for (const panel of panelList) {
        const selector = panelSelectors.get(panel);
        if (selector === undefined) {
            continue;
        }

        await expect(frameLocator.locator(selector)).not.toBeInViewport();

        await sendMessage({
            id: "panelList",
            method: "panel_toggle",
            params: {
                name: panel,
            },
        })

        await expect(frameLocator.locator(selector)).toBeInViewport();

        await sendMessage({
            id: "panelList",
            method: "panel_toggle",
            params: {
                name: panel,
            },
        })

        await expect(frameLocator.locator(selector)).not.toBeInViewport();
    }
});

test("test search query endpoints", async ({ page, pmId, sendMessage, receiveMessage }) => {
    const frameLocator = page.frameLocator("#" + pmId);

    const query = "Video";
    let currentQuery = null;

    await receiveMessage(async (data) => {
        if (data.id === "currentQuery") {
            currentQuery = data.result.query;
        }
    })

    await sendMessage({
        method: "search_set_query",
        params: {
            query: query,
        }
    })

    await sendMessage({
        id: "currentQuery",
        method: "search_get_query",
    })

    await expect(async () => {
        await expect(currentQuery).toBe(query);
    }).toPass();

    const totalNodes = await frameLocator.locator(".baklava-node").count();
    const highlightedNodes = await frameLocator.locator(".baklava-node:not(.--greyed-out)").count();
    const greyedOutNodes = await frameLocator.locator(".baklava-node.--greyed-out").count();
    await expect(highlightedNodes).toBe(2);
    await expect(greyedOutNodes).toBe(totalNodes - 2);
})
