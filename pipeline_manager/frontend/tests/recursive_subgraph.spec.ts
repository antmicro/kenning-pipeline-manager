import { test, expect, TestInfo } from '@playwright/test';
import fs from 'fs/promises';
import { getUrl, openFileChooser, expectSomeErrors } from './config.js';

const recursiveSpec = {
    nodes: [
        {
            name: 'Node',
            interfaces: [],
            subgraphId: '2c741b7b-550f-5037-a039-b19df7a9742d',
        },
    ],
    graphs: [
        {
            id: '2c741b7b-550f-5037-a039-b19df7a9742d',
            name: 'Graph',
            nodes: [
                {
                    id: '16ca58ea-fb48-4276-a437-29452a284997',
                    name: 'Node',
                    interfaces: [],
                    subgraph: '2c741b7b-550f-5037-a039-b19df7a9742d',
                },
            ],
            connections: [],
        },
    ],
};

test('test recursive subgraph detection', async ({ page }, testInfo: TestInfo) => {
    await page.goto(getUrl());

    const specPath = testInfo.outputPath('recursive-subgraph.json');
    await fs.writeFile(specPath, JSON.stringify(recursiveSpec, null, 4));

    const fileChooser = await openFileChooser(page, 'specification');
    await fileChooser.setFiles(specPath);

    await expectSomeErrors(page);
});
