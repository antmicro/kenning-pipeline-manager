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

    allowLoopbacks = false;

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

            if (from.isInput && !to.isInput) {
                // reverse connection
                const tmp = from;
                from = to;
                to = tmp;
            }

            if (from.isInput || !to.isInput) {
                // connections are only allowed from input to output interface
                return { connectionAllowed: false };
            }

            // prevent duplicate connections
            if (graphInstance.connections.some((c) => c.to === to)) {
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
}
