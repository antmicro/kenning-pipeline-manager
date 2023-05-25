/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

/*
 * Custom pipeline editor - Implements logic for adding, removing, editing nodes and
 * conections between them.
 * Inherits from baklavajs/core/src/editor.ts
 */

import { Editor, DummyConnection } from 'baklavajs';

export default class PipelineManagerEditor extends Editor {
    readonly = false;

    hideHud = false;

    allowLoopbacks = false;

    nodeIcons = new Map();

    /* eslint-disable no-param-reassign */
    /* eslint-disable no-underscore-dangle */
    constructor() {
        super();
        const graphInstance = this._graph;
        graphInstance.checkConnection = (from, to) => {
            if (!from || !to) {
                return { connectionAllowed: false };
            }

            const fromNode = graphInstance.findNodeById(from.nodeId);
            const toNode = graphInstance.findNodeById(to.nodeId);
            if (fromNode && toNode && fromNode === toNode && !graphInstance.editor.allowLoopbacks) {
                // connections must be between two separate nodes.
                return { connectionAllowed: false };
            }

            // TODO improve handling of inout ports
            if (from.isInput && !to.isInput) {
                // reverse connection
                const tmp = from;
                from = to;
                to = tmp;
            }

            if (from.isInput && from.direction !== 'inout') {
                // connections are only allowed from input to output or inout interface
                return { connectionAllowed: false };
            }

            if (!to.isInput) {
                // we can connect only to input
                return { connectionAllowed: false };
            }

            // prevent duplicate connections
            if (graphInstance.connections.some((c) => c.from === from && c.to === to)) {
                return { connectionAllowed: false };
            }

            // the default behavior for outputs is to provide any number of
            // output connections
            if (
                from.maxConnectionsCount > 0 &&
                from.connectionCount + 1 > from.maxConnectionsCount
            ) {
                return { connectionAllowed: false };
            }

            // the default behavior for inputs is to allow only one connection
            if (
                (to.maxConnectionsCount === 0 || to.maxConnectionsCount === undefined) &&
                to.connectionCount > 0
            ) {
                return { connectionAllowed: false };
            }

            if (to.maxConnectionsCount > 0 && to.connectionCount + 1 > to.maxConnectionsCount) {
                return { connectionAllowed: false };
            }

            if (graphInstance.events.checkConnection.emit({ from, to }).prevented) {
                return { connectionAllowed: false };
            }

            const hookResults = graphInstance.hooks.checkConnection.execute({ from, to });
            if (hookResults.some((hr) => !hr.connectionAllowed)) {
                return { connectionAllowed: false };
            }

            const connectionsInDanger = Array.from(
                new Set(hookResults.flatMap((hr) => hr.connectionsInDanger)),
            );
            return {
                connectionAllowed: true,
                dummyConnection: new DummyConnection(from, to),
                connectionsInDanger,
            };
        };
    }

    save() {
        const state = super.save();
        state.graph.panning = this._graph.panning;
        state.graph.scaling = this._graph.scaling;
        return state;
    }

    load(state) {
        super.load(state);
        if (state.graph.panning !== undefined) {
            this._graph.panning = state.graph.panning;
        }
        if (state.graph.scaling !== undefined) {
            this._graph.scaling = state.graph.scaling;
        }
    }

    getNodeIconPath(nodeType) {
        return this.nodeIcons.get(nodeType) || undefined;
    }
}
