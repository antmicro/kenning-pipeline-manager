import { test, expect } from '@playwright/test';
import { getPathToJsonFile, getNode, getUrl, loadSpecification, loadDataflow, openFileChooser } from './config.js';

import os from 'os';
import fs from 'fs/promises';
import path from 'path';

function convertHexToRGB(hex) {
  hex = hex.replace(/^#/, '');
  return {
    red: parseInt(hex.substring(0, 2), 16),
    green: parseInt(hex.substring(2, 4), 16),
    blue: parseInt(hex.substring(4, 6), 16),
  };
}

test('node pill from dataflow overrides node pill from spec', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-specification.json');

    const dataflow = JSON.parse(
        await fs.readFile(getPathToJsonFile('sample-dataflow.json'), 'utf-8'),
    );

    const nodeWithPill = dataflow.graphs[0].nodes.find((n) => n.name === 'GaussianKernel');
    nodeWithPill['pill'] = {'text': 'updated text', "color": '#123456'};
    const outputPath = path.join(os.tmpdir(), 'sample-dataflow-with-pill.json');
    await fs.writeFile(outputPath, JSON.stringify(dataflow, null, 2), 'utf-8');

    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(outputPath);

    const pill = getNode(page, 'GaussianKernel').locator('.pill');
    const color = convertHexToRGB('#123456');

    await expect(pill).toHaveText('updated text');
    await expect(pill).toHaveCSS('background-color', `rgb(${color.red}, ${color.green}, ${color.blue})`);
});

test('node pill from spec overrides node pill from style', async ({ page }) => {
    await page.goto(getUrl());
    await loadSpecification(page, 'sample-specification.json');

    const specification = JSON.parse(
        await fs.readFile(getPathToJsonFile('sample-specification.json'), 'utf-8'),
    );

    const nodeWithPill = specification.nodes.find((n) => n.name === 'GaussianKernel');
    nodeWithPill['style'] = 'test';
    specification.metadata['style'] = {
        'pill': {'text': 'updated text', "color": '#123456'}
    };
    const outputPath = path.join(os.tmpdir(), 'sample-specification-with-pill.json');
    await fs.writeFile(outputPath, JSON.stringify(specification, null, 2), 'utf-8');

    const fileChooser = await openFileChooser(page, 'dataflow');
    await fileChooser.setFiles(outputPath);

    await loadDataflow(page, 'sample-dataflow.json');

    const pill = getNode(page, 'GaussianKernel').locator('.pill');
    const color = convertHexToRGB('#999999');

    await expect(pill).toHaveText('kernel');
    await expect(pill).toHaveCSS('background-color', `rgb(${color.red}, ${color.green}, ${color.blue})`);
});

test('node pill is visible in minimal node', async ({ page }) => {
    await page.goto(getUrl());

    await loadSpecification(page, 'sample-rectangle-grouping-specification.json');
    await loadDataflow(page, 'sample-rectangle-grouping-dataflow.json');

    const minimalNode = getNode(page, 'SaveModel');
    await expect(minimalNode).toBeVisible();
    await expect(minimalNode.locator('.__title')).toBeHidden();

    const pill = minimalNode.locator('.pill');
    const color = convertHexToRGB('#999999');

    await expect(pill).toHaveText('user');
    await expect(pill).toHaveCSS('background-color', `rgb(${color.red}, ${color.green}, ${color.blue})`);
});
