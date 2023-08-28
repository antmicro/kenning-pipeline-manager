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

/* eslint-disable max-classes-per-file */

import {
    Editor,
    GRAPH_NODE_TYPE_PREFIX,
    NodeInterface,
} from '@baklavajs/core';

import { useGraph } from '@baklavajs/renderer-vue';

import { toRaw, nextTick } from 'vue';
import {
    SUBGRAPH_INPUT_NODE_TYPE,
    SUBGRAPH_OUTPUT_NODE_TYPE,
    SUBGRAPH_INOUT_NODE_TYPE,
} from './subgraphInterface.js';
import createPipelineManagerGraph from './CustomGraph.js';
import LayoutManager from '../core/LayoutManager.js';
import { suppressHistoryLogging } from '../core/History.ts';
import { parseInterfaces, applySidePositions } from '../core/interfaceParser.js';
import CreateCustomGraphNodeType from './CustomGraphNode.js';

/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
export default class PipelineManagerEditor extends Editor {
    readonly = false;

    allowLoopbacks = false;

    nodeIcons = new Map();

    baseURLs = new Map();

    baseIconUrls = new Map();

    nodeURLs = new Map();

    layoutManager = new LayoutManager();

    /* eslint-disable no-param-reassign */
    /* eslint-disable no-underscore-dangle */

    subgraphStack = [];

    registerGraph(graph) {
        const customGraph = createPipelineManagerGraph(graph);
        super.registerGraph(customGraph);
    }

    save() {
        // Save all changes done to subgraphs before saving
        const currentGraphId = this._graph.id;
        const stackCopy = Array.from(toRaw(this.subgraphStack));
        stackCopy.forEach(this.backFromSubgraph.bind(this));

        const state = { graph: this.graph.save() };

        state.graph.panning = this._graph.panning;
        state.graph.scaling = this._graph.scaling;
        state.subgraphs = [];
        // subgraphs are stored in state.subgraphs, there is no need to store it
        // in nodes itself
        const recurrentSubgraphSave = (node) => {
            if (node.name?.startsWith(GRAPH_NODE_TYPE_PREFIX)) {
                node.name = node.name.slice(GRAPH_NODE_TYPE_PREFIX.length);
                node.subgraph = node.graphState.id;
                node.graphState.nodes = node.graphState.nodes
                    .filter((n) =>
                        ![
                            SUBGRAPH_INPUT_NODE_TYPE,
                            SUBGRAPH_OUTPUT_NODE_TYPE,
                            SUBGRAPH_INOUT_NODE_TYPE,
                        ].includes(n.type),
                    );
                state.subgraphs.push(node.graphState);
                node.graphState.nodes.forEach(recurrentSubgraphSave);
            }
            delete node.graphState;
        };
        state.graph.nodes.forEach(recurrentSubgraphSave);

        // Main graph should have no IO
        delete state.graph.inputs;
        delete state.graph.outputs;

        if (state.subgraphs.length !== 0) {
            state.subgraphs.push(state.graph);
            delete state.graph;
            state.graph = {};
            state.graph.entryGraph = currentGraphId;
        }

        /* eslint-disable no-unused-vars */
        stackCopy.forEach(([_, subgraphNode]) => {
            const errors = this.switchToSubgraph(subgraphNode);
            if (Array.isArray(errors) && errors.length) {
                throw new Error(errors);
            }
        });
        /* eslint-enable no-unused-vars */

        if (state.subgraphs.length === 0) {
            delete state.subgraphs;
        }

        // Main graph should have no IO
        delete state.graph.inputs;
        delete state.graph.outputs;

        return state;
    }

    /**
     * Cleans all graphs in the editor.
     */
    deepCleanEditor() {
        this.subgraphStack.forEach(this.backFromSubgraph.bind(this));
        this.cleanEditor();
        this.graphName = undefined;
    }

    /**
     * Cleans up the current graph current graph editor.
     */
    cleanEditor() {
        const graphInstance = this._graph;

        suppressHistoryLogging(true);
        for (let i = graphInstance.connections.length - 1; i >= 0; i -= 1) {
            graphInstance.removeConnection(graphInstance.connections[i]);
        }
        for (let i = graphInstance.nodes.length - 1; i >= 0; i -= 1) {
            graphInstance.removeNode(graphInstance.nodes[i]);
        }
        suppressHistoryLogging(false);
    }

    unregisterGraphs() {
        [...this.graphs]
            .filter((graph) => graph.id !== this._graph.id)
            .forEach((graph) => this.unregisterGraph(graph));
        this.subgraphStack = [];
    }

    unregisterNodes() {
        this.nodeTypes.forEach((_, nodeKey) => {
            this.unregisterNodeType(nodeKey);
        });
    }

    async load(state) {
        // All subgraphs should be unregistered to avoid conflicts later when trying to
        // load into subgraph (in that case there may be two subgraphs with the same ID, one
        // of them from the previous session).
        this.unregisterGraphs();

        // There can be only one subgraph node matching to a particular subgraphs
        const usedInstances = new Set();

        const recurrentSubgraphLoad = (node) => {
            const errors = [];
            if (node.subgraph !== undefined) {
                const fittingTemplate = state.subgraphs.filter(
                    (template) => template.id === node.subgraph,
                );
                if (fittingTemplate.length !== 1) {
                    return [`Expected exactly one template with ID ${node.name}, got ${fittingTemplate.length}`];
                }
                if (usedInstances.has(node.subgraph)) {
                    return [`Subgraph ${node.subgraph} has multiple nodes pointing to it - only unique IDs are allowed`];
                }
                usedInstances.add(node.subgraph);
                node.graphState = structuredClone(fittingTemplate[0]);

                node.graphState.nodes.forEach((n) => {
                    errors.push(...recurrentSubgraphLoad(n));
                });
                node.name = `${GRAPH_NODE_TYPE_PREFIX}${node.name}`;

                const interfaces = node.graphState.interfaces.map(
                    (io) => {
                        const correspondingInterface = node.interfaces.find(
                            (intf) => intf.subgraphNodeId === io.id,
                        );
                        if (correspondingInterface === undefined) {
                            errors.push(`No corresponding subgraphNodeId for subgraph interface of id ${io.id} found.`);
                        }

                        return {
                            ...io,
                            ...correspondingInterface,
                        };
                    },
                );

                if (errors.length) {
                    return errors;
                }

                const out = parseInterfaces(interfaces, [], []);
                if (Array.isArray(out) && out.length) {
                    return out;
                }
                const { inputs, outputs } = out;

                node.graphState.inputs = Object.values(inputs);
                node.graphState.outputs = Object.values(outputs);

                delete node.graphState.interfaces;

                delete node.subgraph;
            }
            return errors;
        };

        // Load the node state as it is, wait until vue renders new nodes so that
        // node dimensions can be retrieved from DOM elements and then update the
        // location based on autolayout results. The editor is set to readonly
        // during loading to prevent any changes that may happen between graph load
        // and layout computation
        const readonlySetting = this.readonly;
        this.readonly = true;
        let errors = [];

        let panning;
        let scaling;
        let rootGraph;
        let entryGraph;

        if (state.graph.entryGraph !== undefined) {
            // multi-graph dataflow
            const usedSubgraphs = new Set();

            state.subgraphs.forEach((subgraph) => {
                subgraph.nodes.forEach((n) => {
                    if (n.subgraph !== undefined) {
                        usedSubgraphs.add(n.subgraph);
                    }
                });
            });
            // Finding a root graph by checking which graph is not referenced by any other
            rootGraph = state.subgraphs.find((subgraph) =>
                !usedSubgraphs.has(subgraph.id),
            );
            if (rootGraph === undefined) {
                return ['No root graph found. Make sure you graph does not have any reccurency'];
            }

            entryGraph = state.subgraphs.find(
                (subgraph) => subgraph.id === state.graph.entryGraph,
            );
            if (entryGraph === undefined) {
                return [`No entry graph found of id '${state.graph.entryGraph}'`];
            }
            ({ panning, scaling } = entryGraph);
        } else {
            // single-graph dataflow
            rootGraph = state.graph;
            entryGraph = state.graph;
            ({ panning, scaling } = state.graph);
        }

        try {
            rootGraph.nodes.forEach((n) => {
                errors.push(...recurrentSubgraphLoad(n));
            });

            if (errors.length) {
                return errors;
            }

            rootGraph.inputs = [];
            rootGraph.outputs = [];

            state = this.hooks.load.execute(state);
            errors = this._graph.load(rootGraph);
        } catch (err) {
            // If anything goes wrong during dataflow loading, the editor is cleaned and an
            // appropriate error is returned.
            this.cleanEditor();
            this.readonly = readonlySetting;
            return [err.toString()];
        }
        if (Array.isArray(errors) && errors.length && process.env.VUE_APP_GRAPH_DEVELOPMENT_MODE !== 'true') {
            this.cleanEditor();
            this.readonly = readonlySetting;
            return errors;
        }
        this.events.loaded.emit();
        this.graphName = state.graph.name;
        this.readonly = readonlySetting;

        if (state.graph.entryGraph !== undefined) {
            const dfs = (subgraph, path) => {
                if (subgraph?.nodes !== undefined) {
                    for (let i = 0; i < subgraph.nodes.length; i += 1) {
                        if (subgraph.nodes[i].subgraph !== undefined) {
                            if (subgraph.nodes[i].subgraph.id === state.graph.entryGraph) {
                                return [...path, subgraph.nodes[i]];
                            }
                            const returnedPath = dfs(
                                subgraph.nodes[i].subgraph,
                                [...path, subgraph.nodes[i]],
                            );
                            if (returnedPath.length) {
                                return returnedPath;
                            }
                        }
                    }
                }
                return [];
            };

            // Finding a path to the defined entry and switching to it sequentially
            const path = dfs(this._graph, []);
            path.forEach((node) => {
                this.switchToSubgraph(node);
            });
        }

        if (this.layoutManager.layoutEngine.activeAlgorithm !== 'NoLayout') {
            await nextTick();
            await this.applyAutolayout(false);
        }

        // We need graph switched and sidebar rendered for autozoom
        await nextTick();
        if (panning !== undefined) {
            this._graph.panning = panning;
        }
        if (scaling !== undefined) {
            this._graph.scaling = scaling;
        }
        if (scaling === undefined && panning === undefined) {
            this.centerZoom();
        }
        return errors;
    }

    centerZoom() {
        if (!Array.isArray(this._graph.nodes) || this._graph.nodes.length === 0) return;
        if (typeof document === 'undefined') {
            return;
        }

        const {
            graphHeight,
            graphWidth,
            leftmostX,
            topmostY,
        } = this._graph.size();

        const margin = 100;
        const terminalHeight =
            document.getElementsByClassName('terminal-wrapper')[0]?.offsetHeight ?? 0;
        const navbarHeight = document.getElementsByClassName('wrapper')[0]?.offsetHeight ?? 0;
        const sideBarWidth =
            document.getElementsByClassName('baklava-node-palette')[0]?.offsetWidth ?? 0;

        const editorHeight = window.innerHeight - terminalHeight - navbarHeight;
        const editorWidth = window.innerWidth - sideBarWidth;

        const scalingY = editorHeight / (graphHeight + 2 * margin);
        const scalingX = editorWidth / (graphWidth + 2 * margin);

        if (scalingX > scalingY) {
            const graphCenter = (graphWidth + 2 * margin) / 2;
            const editorCenter = (editorWidth / 2) * (1 / scalingY);

            const translationX = editorCenter - graphCenter;

            this._graph.panning = {
                x: -(leftmostX - margin - translationX - sideBarWidth / scalingY),
                y: -(topmostY - margin),
            };
            this._graph.scaling = scalingY;
        } else {
            const graphCenter = (graphHeight + 2 * margin) / 2;
            const editorCenter = (editorHeight / 2) * (1 / scalingX);

            const translationY = editorCenter - graphCenter;

            this._graph.panning = {
                x: -(leftmostX - margin - sideBarWidth / scalingX),
                y: -(topmostY - margin - translationY),
            };
            this._graph.scaling = scalingX;
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

    addGraphTemplate(template, category, type) {
        if (this.events.beforeAddGraphTemplate.emit(template).prevented) {
            return;
        }
        if (this.nodeTypes.has(`${GRAPH_NODE_TYPE_PREFIX}${template.id}`)) {
            return;
        }
        this._graphTemplates.push(template);
        this.graphTemplateEvents.addTarget(template.events);
        this.graphTemplateHooks.addTarget(template.hooks);

        const customGraphNodeType = CreateCustomGraphNodeType(template, type);
        this.registerNodeType(customGraphNodeType, { category, title: template.name });

        this.events.addGraphTemplate.emit(template);
    }

    switchGraph(subgraphNode) {
        const convertToUpperCase = (str) => `${str[0].toUpperCase()}${str.slice(1)}`;
        if (this._switchGraph === undefined) {
            const { switchGraph } = useGraph();
            this._switchGraph = switchGraph;
        }
        // disable history logging for the switch - don't push nodes being created here
        suppressHistoryLogging(true);

        // Propagate side data back to the subgraph such that if it was changed, the
        // selector inside would be updated
        Object.values(subgraphNode.inputs).forEach((intf) => {
            const subgraphIntf = subgraphNode.subgraph.inputs.find(
                (subIntf) => subIntf.id === intf.id,
            );
            subgraphIntf.sidePosition = intf.sidePosition;

            const subgraphIntfNode = subgraphNode.subgraph.nodes.find(
                (node) => node.graphInterfaceId === intf.id,
            );

            subgraphIntfNode.inputs.side.value = convertToUpperCase(intf.side);
        });

        Object.values(subgraphNode.outputs).forEach((intf) => {
            const subgraphIntf = subgraphNode.subgraph.outputs.find(
                (subIntf) => subIntf.id === intf.id,
            );
            subgraphIntf.sidePosition = intf.sidePosition;

            const subgraphIntfNode = subgraphNode.subgraph.nodes.find(
                (node) => node.graphInterfaceId === intf.id,
            );

            subgraphIntfNode.inputs.side.value = convertToUpperCase(intf.side);
        });

        this._graph = subgraphNode.subgraph;
        this._switchGraph(subgraphNode.subgraph);
        suppressHistoryLogging(false);
        nextTick().then(() => {
            const graph = this.graph.save();
            this.layoutManager.registerGraph(graph);
            this.layoutManager.computeLayout(graph).then(this.updateNodesPosition.bind(this));
        });
    }

    switchToSubgraph(subgraphNode) {
        this.subgraphStack.push([this._graph.id, subgraphNode]);
        this.switchGraph(subgraphNode);
    }

    /**
     * Switches back from a displayed graph.
     * The function changes the currently displayed graph and propagates changes in interfaces
     * back to the graph node.
     *
     * It also updates the graph node's interfaces to match the ones in the graph.
     * It checks for existing interface nodes, checks which were added, removed and changed
     * and updates the graph node's interfaces accordingly.
     */
    backFromSubgraph() {
        const [newGraphId, subgraphNode] = this.subgraphStack.pop();
        const newGraph = [...this.graphs].filter((graph) => graph.id === newGraphId)[0];

        suppressHistoryLogging(true);

        // Updates information of the graph about its interfaces
        this._graph.updateInterfaces();

        // applySidePositions needs a map, not an arrray
        const ifaceOrPositionErrors = applySidePositions(
            Object.fromEntries(this._graph.inputs.map((intf) => [intf.subgraphNodeId, intf])),
            Object.fromEntries(this._graph.outputs.map((intf) => [intf.subgraphNodeId, intf])),
        );

        if (Array.isArray(ifaceOrPositionErrors)) {
            throw new Error(
                `Internal error occured while returning back from a subgraph. ` +
                `Reason: ${ifaceOrPositionErrors.join('. ')}`,
            );
        }

        // Updating interfaces of a graph node
        Object.values(subgraphNode.inputs).forEach((k) => {
            if (!Object.keys(ifaceOrPositionErrors.inputs).includes(k.subgraphNodeId)) {
                subgraphNode.removeInput(k.name);
            }
        });
        Object.entries(ifaceOrPositionErrors.inputs).forEach(([id, intf]) => {
            const foundIntf = Object.values(subgraphNode.inputs).find(
                (io) => io.subgraphNodeId === id,
            );
            if (foundIntf === undefined) {
                const baklavaIntf = new NodeInterface(intf.name);
                Object.assign(baklavaIntf, intf);
                subgraphNode.addInput(intf.name, baklavaIntf);
            } else {
                Object.assign(foundIntf, intf);
            }
        });

        Object.values(subgraphNode.outputs).forEach((k) => {
            if (!Object.keys(ifaceOrPositionErrors.outputs).includes(k.subgraphNodeId)) {
                subgraphNode.removeOutput(k.name);
            }
        });
        Object.entries(ifaceOrPositionErrors.outputs).forEach(([id, intf]) => {
            const foundIntf = Object.values(subgraphNode.outputs).find(
                (io) => io.subgraphNodeId === id,
            );
            if (foundIntf === undefined) {
                const baklavaIntf = new NodeInterface(intf.name);
                Object.assign(baklavaIntf, intf);
                subgraphNode.addOutput(intf.name, baklavaIntf);
            } else {
                Object.assign(foundIntf, intf);
            }
        });

        this._graph = newGraph;
        this._switchGraph(this._graph);

        suppressHistoryLogging(false);
    }

    isInSubgraph() {
        return this.subgraphStack.length > 0;
    }

    async applyAutolayout(resetLocations = true) {
        const state = this.graph.save();
        if (resetLocations) {
            state.nodes.forEach((node) => {
                node.position = undefined;
            });
        }
        this.layoutManager.registerGraph(state);
        const updatedGraph = await this.layoutManager.computeLayout(state);
        this.updateNodesPosition(updatedGraph);
    }

    updateNodesPosition(updatedGraph) {
        updatedGraph.nodes.forEach((updatedState) => {
            const node = this.graph.nodes.filter(
                (nodeInstance) => updatedState.id === nodeInstance.id,
            )[0];
            node.position = updatedState.position;
        });
    }
}
