/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineNode, TextInputInterface, NodeInterface } from 'baklavajs';
import { v4 as uuidv4 } from 'uuid';

// Those files are exported here as Baklavajs does not export them
export const SUBGRAPH_OUTPUT_NODE_TYPE = '__baklava_SubgraphOutputNode';
export const SUBGRAPH_INPUT_NODE_TYPE = '__baklava_SubgraphInputNode';

// Just like there are special nodes representing subgraph input and output,
// There should be one for it's inout.
export const SUBGRAPH_INOUT_NODE_TYPE = "__baklava_SubgraphInoutNode";
export const SubgraphInoutNode = defineNode({
    type: SUBGRAPH_INOUT_NODE_TYPE,
    title: "Subgraph Inout",
    inputs: {
        name: () => new TextInputInterface("Name", "Inout").setPort(false),
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
