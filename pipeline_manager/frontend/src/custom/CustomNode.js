/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Implements additional functions for CustomNode
 */

import { useViewModel, useGraph } from '@baklavajs/renderer-vue';
import { GRAPH_NODE_TYPE_PREFIX } from '@baklavajs/core';

/**
 * The function decides whether a name for the option should be displayed.
 *
 * @param optionType Name of the option component
 * @returns True if the name should be displayed, false otherwise.
 */
export function getOptionName(optionType) {
    switch (optionType) {
        case 'InputInterface':
        case 'SelectInterface':
        case 'ListInterface':
        case 'TextInterface':
        case 'HexInterface':
            return true;
        case 'NumberInterface':
        case 'IntegerInterface':
        case 'CheckboxInterface':
        case 'SliderInterface':
        case 'NodeInterface':
        default:
            return false;
    }
}

/**
 * Updates a side and optionally a sidePosition of an interface
 *
 * @param node in which the interface is updated
 * @param intf interface to update
 * @param newSide new side of the interface
 * @param newSidePosition new position of the interface. If it is occupied
 * @param swap if true then if an interface is found in 'newSidePosition' then they
 * are swapped
 * then an old interface is moved.
 */
/* eslint-disable no-param-reassign */
export function updateInterfacePosition(
    node,
    intf,
    newSide,
    newSidePosition = undefined,
    swap = false,
) {
    const oldSidePosition = intf.sidePosition;

    intf.side = newSide;
    if (newSidePosition !== undefined) {
        intf.sidePosition = newSidePosition;
    }

    const found = [
        ...Object.values(node.inputs),
        ...Object.values(node.outputs),
    ].find(
        (io) => io.id !== intf.id &&
            io.sidePosition === intf.sidePosition &&
            io.side === intf.side,
    );

    if (found !== undefined) {
        if (newSidePosition !== undefined && swap) {
            found.sidePosition = oldSidePosition;
        } else {
            const intfToMove = newSidePosition === undefined ? intf : found;

            // Finding the first non occupied side position on that side
            const sameSide = [
                ...Object.values(node.inputs),
                ...Object.values(node.outputs),
            ].filter((io) => io.side === intfToMove.side && !io.hidden);
            const occupiedPositions = sameSide.map((io) => io.sidePosition);

            let proposedPosition = 0;
            while (occupiedPositions.includes(proposedPosition)) {
                proposedPosition += 1;
            }

            intfToMove.sidePosition = proposedPosition;
        }
    }
}

/**
 * Wrapper for nodes removal
 *
 * @param node node to remove. Can be either a graph node or a regular node
 * @param unwrapGraph determines whether to unwrap the graph node contents
 * into the current graph. Can be used only when removing a graph node
 */
export function removeNode(node, unwrapGraph = false) {
    if (node.type.startsWith(GRAPH_NODE_TYPE_PREFIX) && unwrapGraph) {
        const { viewModel } = useViewModel();
        viewModel.value.editor.unwrapSubgraph(node);
    } else {
        const { graph } = useGraph();
        graph.value.removeNode(node);
    }
}
