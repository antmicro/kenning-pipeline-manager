/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import cytoscape from 'cytoscape';

import cola from 'cytoscape-cola';
import dagre from 'cytoscape-dagre';
import BaseLayoutEngine from './baseEngine';

cytoscape.use(dagre);
cytoscape.use(cola);

export default class CytoscapeLayoutEngine extends BaseLayoutEngine {
    // The only cytoscape algorithm not defined here are 'null' (every node to
    // (0, 0)) and 'preset' (every node to user defined position)
    availableAlgorithms = [
        'cola',
        'dagre',
        'random',
        'grid',
        'circle',
        'concentric',
        'breadthfirst',
        'cose',
    ];

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
            case 'cola':
                options.nodeSpacing = (node) => 150;
                break;
            case 'dagre':
                options.nodeSep = 50;
                options.rankSep = 100;
                break;
            default:
                break;
        }
        /* eslint-enable no-unused-vars */

        const layout = cytoscapeGraph.layout(options);
        layout.run();
        if (['cose', 'cola'].includes(this.activeAlgorithm)) {
            // wait until asynchronous algorithm finish calculations
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
