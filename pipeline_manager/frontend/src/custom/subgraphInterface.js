/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNode, TextInputInterface, NodeInterface, SelectInterface } from 'baklavajs';
import { v4 as uuidv4 } from 'uuid';

// Those files are exported here as Baklavajs does not export them
export const SUBGRAPH_INPUT_NODE_TYPE = '__baklava_CustomSubgraphInputNode';
export const SubgraphInputNode = defineNode({
    type: SUBGRAPH_INPUT_NODE_TYPE,
    title: "Subgraph Input",
    inputs: {
        name: () => new TextInputInterface("Name", "Input").setPort(false),
        connectionSide: () => new SelectInterface("Interface side", "Left", ["Left", "Right"]).setPort(false),
    },
    outputs: {
        placeholder: () => {
            const ni = new NodeInterface("Connection", undefined);
            ni.direction = 'output'
            ni.connectionSide = 'right';
            return ni;
        }
    },
    onCreate() {
        this.graphInterfaceId = uuidv4();
    },
});

export const SUBGRAPH_OUTPUT_NODE_TYPE = '__baklava_CustomSubgraphOutputNode';
export const SubgraphOutputNode = defineNode({
    type: SUBGRAPH_OUTPUT_NODE_TYPE,
    title: "Subgraph Output",
    inputs: {
        name: () => new TextInputInterface("Name", "Output").setPort(false),
        connectionSide: () => new SelectInterface("Interface side", "Right", ["Left", "Right"]).setPort(false),
        placeholder: () => {
            const ni = new NodeInterface("Connection", undefined)
            ni.direction = 'input'
            ni.connectionSide = 'left'
            return ni;
        }
    },
    onCreate() {
        this.graphInterfaceId = uuidv4();
    },
});

// Just like there are special nodes representing subgraph input and output,
// There should be one for it's inout.
export const SUBGRAPH_INOUT_NODE_TYPE = "__baklava_CustomSubgraphInoutNode";
export const SubgraphInoutNode = defineNode({
    type: SUBGRAPH_INOUT_NODE_TYPE,
    title: "Subgraph Inout",
    inputs: {
        name: () => new TextInputInterface("Name", "Inout").setPort(false),
        connectionSide: () => new SelectInterface("Interface side", "Left", ["Left", "Right"]).setPort(false),
        placeholder: () => {
            const ni = new NodeInterface("Connection", undefined);
            ni.direction = 'inout';
            ni.connectionSide = 'left';
            return ni;
        }
    },
    outputs: {},
    onCreate() {
        this.graphInterfaceId = uuidv4()
    }
})
