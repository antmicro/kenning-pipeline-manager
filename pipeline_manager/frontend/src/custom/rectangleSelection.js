/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checks if node is present inside selection rectangle
 * @returns
 */
export default function nodeInsideSelection(graph, node, boundingRect) {
    const nodeHTMLelement = document.getElementById(node.id);
    const selectionBoundingRect = boundingRect;

    const navBarHeight = 60;
    const panningX = graph.panning.x;
    const panningY = graph.panning.y;
    const { scaling } = graph;

    const nodeX = scaling * (panningX + node.position.x);
    const nodeY = scaling * (panningY + node.position.y + navBarHeight);
    const nodeWidth = nodeHTMLelement.offsetWidth;
    const nodeHeight = nodeHTMLelement.offsetHeight;

    if (nodeX > selectionBoundingRect.xBegin
    && nodeX + nodeWidth * scaling < selectionBoundingRect.xEnd
    && nodeY > selectionBoundingRect.yBegin
    && nodeY + nodeHeight * scaling < selectionBoundingRect.yEnd) {
        return true;
    }
    return false;
}
