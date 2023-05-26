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

import { Editor, DummyConnection, GraphTemplate, createGraphNodeType } from 'baklavajs';

export default class PipelineManagerEditor extends Editor {
    readonly = false;

    hideHud = false;

    allowLoopbacks = false;

    nodeIcons = new Map();

    baseURLs = new Map();

    nodeURLs = new Map();

    /* eslint-disable no-param-reassign */
    /* eslint-disable no-underscore-dangle */

    registerGraph(graph) {
        graph.checkConnection = function (from, to) {
            if (!from || !to) {
                return { connectionAllowed: false };
            }

            const fromNode = this.findNodeById(from.nodeId);
            const toNode = this.findNodeById(to.nodeId);
            if (fromNode && toNode && fromNode === toNode && !this.editor.allowLoopbacks) {
                // connections must be between two separate nodes.
                return { connectionAllowed: false };
            }

            // reverse connection so that 'from' is input and 'to' is output
            if (
                (from.direction === 'input' && to.direction === 'output') ||
                (from.direction === 'input' && to.direction === 'inout') ||
                (from.direction === 'inout' && to.direction === 'output')
            ) {
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
            if (this.connections.some((c) => c.from === from && c.to === to)) {
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

            if (this.events.checkConnection.emit({ from, to }).prevented) {
                return { connectionAllowed: false };
            }

            const hookResults = this.hooks.checkConnection.execute({ from, to });
            if (hookResults.some((hr) => !hr.connectionAllowed)) {
                return { connectionAllowed: false };
            }

            // List of connections that are removed once the dummyConnection is created
            const connectionsInDanger = [];
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

    getNodeURLs(nodeName) {
        const urls = this.nodeURLs.get(nodeName) || {};

        const fullUrls = [];
        Object.entries(urls).forEach(([urlName, url]) => {
            const t = { ...this.baseURLs.get(urlName) };
            t.url += url;
            fullUrls.push(t);
        });

        return fullUrls;
    }

    getNodeIconPath(nodeName) {
        return this.nodeIcons.get(nodeName) || undefined;
    }

    addGraphTemplate(template, category) {
        if (this.events.beforeAddGraphTemplate.emit(template).prevented) {
            return;
        }
        this._graphTemplates.push(template);
        this.graphTemplateEvents.addTarget(template.events);
        this.graphTemplateHooks.addTarget(template.hooks);

        const nt = createGraphNodeType(template);
        this.registerNodeType(nt, { category: category, title: template.name });

        this.events.addGraphTemplate.emit(template);
    }
}
