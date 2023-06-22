/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { useGraph } from 'baklavajs';

/**
 * Function for calculating node position based on given movementStep.
 *
 * @param movementStep Vue's reference to value containing snap offset
 */
export function gridSnapper(movementStep) {
    const calculateSnappedPosition = (coord) =>
        Math.round(coord / movementStep.value) * movementStep.value;

    return calculateSnappedPosition;
}

/**
 * Creates function that aligns the value of node position along specified axis if it is close
 * enough to other node position
 *
 * @param kind Either 'x' or 'y', defines along which axis the coordinate is aligned
 */
export function nodeSnapper(kind) {
    const { graph } = useGraph();
    const snapDistance = 100;
    const calculateSnappedPosition = (coord, nodeId) => {
        const nearestCoords = graph.value.nodes
            .filter((node) => node.id !== nodeId)
            .map((node) => node.position[kind])
            .filter((otherCoords) => Math.abs(coord - otherCoords) < snapDistance);
        return nearestCoords.length !== 0 ? Math.min(...nearestCoords) : undefined;
    };
    return calculateSnappedPosition;
}
