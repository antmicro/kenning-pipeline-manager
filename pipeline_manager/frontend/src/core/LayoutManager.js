/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Module handles the autolayout calculations.
 * Defines intermediary graph representation, containing:
 * - nodes - list of nodes with properties:
 *   - id - unique id
 *   - width, height - node dimensions
 *   - position - position set after the calculations with the layout engine is done.
 * - connections - list of connections in a graph, each defines property:
 *   - id - unique id
 *   - from - id of the starting node
 *   - to - id of node at the end point
 *
 * Layout Manager contains list of registered layout engines. Layout engines are
 * requested by user in a specification. If no layout engine is set, the default option
 * (setting position to (0, 0)) is used
 */

import NoLayoutAlgorithm from './layoutEngines/noLayoutEngine';

/* eslint-disable no-param-reassign */
function dataflowToGraph(dataflow) {
    const interfaceToNodeId = new Map();
    dataflow.graph.nodes.forEach((node) => {
        Object.values(node.interfaces).forEach((intf) => interfaceToNodeId.set(intf.id, node.id));
    });

    const nodes = dataflow.graph.nodes.map((node) => ({
        id: node.id,
        width: Math.min(node.width, 300),
        height: 300, // TODO
        position: node.position,
    }));
    const connections = dataflow.graph.connections.map((connection) => ({
        id: connection.id,
        from: interfaceToNodeId.get(connection.from),
        to: interfaceToNodeId.get(connection.to),
    }));
    return { nodes, connections };
}

function graphToDataflow(graph, dataflow) {
    const idToPosition = new Map();
    graph.nodes.forEach((node) => idToPosition.set(node.id, node.position));
    dataflow.graph.nodes = dataflow.graph.nodes.map((node) => ({
        ...node,
        position: idToPosition.get(node.id),
    }));
    return dataflow;
}

export default class LayoutManager {
    layoutEngine = undefined;

    usedAlgorithm = undefined;

    // Default option when no layout algorithm is specified
    // Currently it is possible to register it, when more layout algorithms
    // are added it should be 1) automatically registered 2) not possible to
    // choose in available algorithms
    availableEngines = {
        NoLayout: new NoLayoutAlgorithm(),
    };

    constructor() {
        this.useAlgorithm('NoLayout');
    }

    useAlgorithm(algorithm) {
        const [engineName, algorithmName] = algorithm.split(' - ');
        this.layoutEngine = this.availableEngines[engineName];
        if (algorithmName !== undefined) {
            this.layoutEngine.chooseAlgorithm(algorithmName);
        }
        this.usedAlgorithm = algorithm;
    }

    getAvailableAlgorithms() {
        return Object.entries(this.availableEngines)
            .map(([engineName, engine]) => {
                if (engine.availableAlgorithms.length !== 1) {
                    return engine.availableAlgorithms.map(
                        (algorithm) => `${engineName} - ${algorithm}`,
                    );
                }
                return engineName;
            })
            .flat();
    }

    async computeLayout(dataflow) {
        const graph = dataflowToGraph(dataflow);
        const layout = await this.runEngine(graph);
        return graphToDataflow(layout, dataflow);
    }

    async runEngine(graph) {
        return this.layoutEngine.calculate(graph);
    }
}
