/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable object-curly-newline */
import { v4 as uuidv4 } from 'uuid';

import { NodeInterface, defineNode } from '@baklavajs/core';
import { SelectInterface } from '@baklavajs/renderer-vue';
import InputInterface from '../interfaces/InputInterface.js';
/* eslint-enable object-curly-newline */

let CounterInput = 0;
let CounterOutput = 0;
let CounterInout = 0;

// Those files are exported here as Baklavajs does not export them
export const SUBGRAPH_INPUT_NODE_TYPE = '__baklava_CustomSubgraphInputNode';
export const SubgraphInputNode = defineNode({
    type: SUBGRAPH_INPUT_NODE_TYPE,
    title: 'Subgraph Input',
    inputs: {
        name: () => {
            CounterInput += 1;
            const intf = new InputInterface('Name', `Input #${CounterInput}`).setPort(false);
            intf.componentName = 'InputInterface';
            return intf;
        },
        side: () => new SelectInterface('Interface side', 'Left', ['Left', 'Right']).setPort(false),
    },
    outputs: {
        placeholder: () => {
            const ni = new NodeInterface('Connection', undefined);
            ni.direction = 'output';
            ni.side = 'right';
            ni.sidePosition = 0;
            return ni;
        },
    },
    onCreate() {
        this.graphInterfaceId = uuidv4();
    },
});

export const SUBGRAPH_OUTPUT_NODE_TYPE = '__baklava_CustomSubgraphOutputNode';
export const SubgraphOutputNode = defineNode({
    type: SUBGRAPH_OUTPUT_NODE_TYPE,
    title: 'Subgraph Output',
    inputs: {
        name: () => {
            CounterOutput += 1;
            const intf = new InputInterface('Name', `Output #${CounterOutput}`).setPort(false);
            intf.componentName = 'InputInterface';
            return intf;
        },
        side: () =>
            new SelectInterface('Interface side', 'Right', ['Left', 'Right']).setPort(false),
        placeholder: () => {
            const ni = new NodeInterface('Connection', undefined);
            ni.direction = 'input';
            ni.side = 'left';
            ni.sidePosition = 0;
            return ni;
        },
    },
    onCreate() {
        this.graphInterfaceId = uuidv4();
    },
});

// Just like there are special nodes representing subgraph input and output,
// There should be one for it's inout.
export const SUBGRAPH_INOUT_NODE_TYPE = '__baklava_CustomSubgraphInoutNode';
export const SubgraphInoutNode = defineNode({
    type: SUBGRAPH_INOUT_NODE_TYPE,
    title: 'Subgraph Inout',
    inputs: {
        name: () => {
            CounterInout += 1;
            const intf = new InputInterface('Name', `Inout #${CounterInout}`).setPort(false);
            intf.componentName = 'InputInterface';
            return intf;
        },
        side: () => new SelectInterface('Interface side', 'Left', ['Left', 'Right']).setPort(false),
        placeholder: () => {
            const ni = new NodeInterface('Connection', undefined);
            ni.direction = 'inout';
            ni.side = 'left';
            ni.sidePosition = 0;
            return ni;
        },
    },
    onCreate() {
        this.graphInterfaceId = uuidv4();
    },
    outputs: {},
});
