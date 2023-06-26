/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import cytoscape from 'cytoscape';
import BaseLayoutEngine from './baseEngine';

export default class CytoscapeLayoutEngine extends BaseLayoutEngine {
    // The only cytoscape algorithm not defined here are 'null' (every node to
    // (0, 0)) and 'preset' (every node to user defined position)
    availableAlgorithms = ['random', 'grid', 'circle', 'concentric', 'breadthfirst', 'cose'];

    async calculate(graph) {
        const cytoscapeGraph = cytoscape({
            elements: {
                nodes: graph.nodes.map((node) => ({
                    data: { id: node.id, width: node.width, height: node.height },
                })),
                edges: graph.connections.map((connection) => ({
                    data: { id: connection.id, source: connection.from, target: connection.to },
                })),
            },
            style: [
                {
                    selector: 'node',
                    style: {
                        shape: 'rectangle',
                        width: 'data(width)',
                        height: 'data(height)',
                    },
                },
            ],
            styleEnabled: true,
        });

        const options = { name: this.activeAlgorithm };
        /* eslint-disable no-unused-vars */
        switch (this.activeAlgorithm) {
            case 'random':
                options.boundingBox = {
                    x1: 0,
                    y1: 0,
                    w: 2000,
                    h: 2000,
                };
                break;
            case 'grid':
                options.avoidOverlapPadding = 150;
                break;
            case 'cose':
                options.nodeOverlap = 1000;
                options.idealEdgeLength = (edge) => 300;
                break;
            default:
                break;
        }
        /* eslint-enable no-unused-vars */

        const layout = cytoscapeGraph.layout(options);
        layout.run();
        if (this.activeAlgorithm === 'cose') {
            // cose is the only asynchronous algorithm in this engine
            await layout.promiseOn('layoutstop');
        }
        return {
            ...graph,
            nodes: cytoscapeGraph.nodes().map((node) => ({
                id: node.id(),
                position: node.position(),
            })),
        };
    }
}
