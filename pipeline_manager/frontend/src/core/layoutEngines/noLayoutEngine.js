/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Default layout algorithm that puts all nodes into (0, 0) position
 */
export default async function NoLayoutAlgorithm(graph) {
    const nodes = graph.nodes.map((node) => ({
        ...node,
        position: { x: 0, y: 0 },
    }));
    return { ...graph, nodes };
}