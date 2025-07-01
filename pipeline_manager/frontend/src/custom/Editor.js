/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

/*
 * Custom pipeline editor - Implements logic for adding, removing, editing nodes and
 * connections between them.
 * Inherits from baklavajs/core/src/editor.ts
 */

/* eslint-disable max-classes-per-file */

import { Editor } from '@baklavajs/core';

import { useGraph } from '@baklavajs/renderer-vue';

import { nextTick } from 'vue';
import createPipelineManagerGraph from './CustomGraph.js';
import LayoutManager from '../core/LayoutManager.js';
import { suppressHistoryLogging } from '../core/History.ts';
import CreateCustomGraphNodeType from './CustomGraphNode.js';
import { ir } from '../core/interfaceRegistry.ts';

/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
export default class PipelineManagerEditor extends Editor {
    preview = false;

    _hideHud = false;

    get hideHud() {
        return this._hideHud || this.preview;
    }

    set hideHud(val) {
        this._hideHud = val;
    }

    _readonly = false;

    get readonly() {
        return this._readonly || this.preview;
    }

    set readonly(val) {
        this._readonly = val;
    }

    allowLoopbacks = false;

    nodeIcons = new Map();

    nodeColors = new Map();

    baseURLs = new Map();

    baseIconUrls = new Map();

    nodeURLs = new Map();

    nodeStyles = new Map();

    layoutManager = new LayoutManager();

    subgraphStack = [];

    registerGraph(graph) {
        const customGraph = createPipelineManagerGraph(graph);
        super.registerGraph(customGraph);
    }

    /**
     * Saves the state (nodes, connections, layout) of the current graph and its subgraphs.
     * @return {Object} State of the current graph and its subgraphs.
     * @throws {Error} Throws if there are issues switching to a subgraph.
     */
    save() {
        const graphNodes = [];
        while (this.isInSubgraph()) {
            graphNodes.push(this._graph.graphNode);
            this.backFromSubgraph();
        }

        // Save all changes done to subgraphs before saving.
        const currentGraphId = this._graph.id;
        const currentGraphState = this.graph.save();
        currentGraphState.panning = this._graph.panning;
        currentGraphState.scaling = this._graph.scaling;

        const dataflowState = { graphs: [] };

        // Subgraphs are stored in state.subgraphs; there is no need to store it
        // in nodes themselves.
        const recurrentSubgraphSave = (node) => {
            if (node.subgraph !== undefined) {
                dataflowState.graphs.push(node.graphState);
                node.graphState.nodes.forEach(recurrentSubgraphSave);
            }
            delete node.graphState;
        };
        currentGraphState.nodes.forEach(recurrentSubgraphSave);

        currentGraphState.nodes.forEach((node) => {
            node.color = this.getNodeColor(node);
        });

        /* eslint-enable no-unused-vars */
        if (dataflowState.graphs.length) {
            dataflowState.entryGraph = currentGraphId;
        }

        dataflowState.graphs = [currentGraphState, ...dataflowState.graphs];

        graphNodes.reverse().forEach((subgraphNode) => {
            this.switchToSubgraph(subgraphNode);
        });

        return dataflowState;
    }

    /**
     * Cleans all graphs in the editor.
     * @param Determines whether the cleaning process should be stored in history
     */
    deepCleanEditor(suppressHistory = true) {
        this.subgraphStack.forEach(this.backFromSubgraph.bind(this));
        this.cleanEditor(suppressHistory);
        this.graphName = undefined;
    }

    /**
     * Cleans up the current graph current graph editor.
     * @param {bool} suppressHistory Determines whether the cleaning process should
     * be stored in history.
     */
    cleanEditor(suppressHistory = true) {
        while (this.isInSubgraph()) {
            this.backFromSubgraph();
        }
        const graphInstance = this._graph;

        suppressHistoryLogging(suppressHistory);
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

    registerNodeType(type, options) {
        if (this.events.beforeRegisterNodeType.emit({ type, options }).prevented) {
            return;
        }

        const nodeInstance = new type(); // eslint-disable-line new-cap
        this._nodeTypes.set(nodeInstance.type, {
            type,
            category: options?.category ?? 'default',
            title: options?.title ?? nodeInstance.title,
            isCategory: options?.isCategory ?? false,
            color: options?.color,
            subgraphId: options?.subgraphId,
            style: options?.style,
            pill: options?.pill && { color: '#ffffff', ...options.pill },
        });

        this.events.registerNodeType.emit({ type, options });
    }

    /**
     * Loads the dataflow into the editor.
     *
     * @param state dataflow to load
     * @param {bool} preventCentering determines whether to center the graph after loading
     * @param {bool} loadOnly determines whether to load the graph only without adjusting
     * the graph rendering. Can be used when validating graphs without their browser
     * representation.
     * @returns list of errors that occurred during loading
     */
    async load(state, preventCentering = false, loadOnly = false) {
        // All subgraphs should be unregistered to avoid conflicts later when trying to
        // load into subgraph (in that case there may be two subgraphs with the same ID, one
        // of them from the previous session).
        this.unregisterGraphs();
        ir.clearRegistry();

        // There can be only one subgraph node matching to a particular subgraphs
        const usedInstances = new Set();

        const recurrentSubgraphLoad = (node) => {
            const errors = [];
            if (node.subgraph !== undefined) {
                const fittingTemplate = state.graphs.filter(
                    (template) => template.id === node.subgraph,
                );
                if (fittingTemplate.length !== 1) {
                    return [`Expected exactly one template with ID ${node.name}, got ${fittingTemplate.length}`];
                }
                if (usedInstances.has(node.subgraph)) {
                    return [`Subgraph ${node.subgraph} has multiple nodes pointing to it - only unique IDs are allowed`];
                }
                usedInstances.add(node.subgraph);
                [node.graphState] = fittingTemplate;

                node.graphState.nodes.forEach((n) => {
                    errors.push(...recurrentSubgraphLoad(n));
                });
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

        if (!state.graphs.length) {
            return ['No graphs found'];
        }

        let entryGraph;
        if (state.entryGraph) {
            entryGraph = state.graphs.find(
                (graph) => graph.id === state.entryGraph,
            );

            if (!entryGraph) {
                return [`No entry graph found of id '${state.entryGraph}'`];
            }
        } else {
            entryGraph = state.graphs[0]; // eslint-disable-line prefer-destructuring
        }
        const { panning, scaling } = entryGraph;

        const usedGraphs = new Set();

        this.nodeColors.clear();
        state.graphs.forEach((graph) => {
            graph.nodes.forEach((n) => {
                if (n.subgraph !== undefined) {
                    usedGraphs.add(n.subgraph);
                }
                this.setNodeColor(n.id, n.color);
            });
        });
        // Finding a root graph by checking which graph is not referenced by any other
        const rootGraph = state.graphs.find((graph) =>
            !usedGraphs.has(graph.id),
        );
        if (rootGraph === undefined) {
            return ['No root graph found. Make sure you graph does not have any recursion.'];
        }

        try {
            rootGraph.nodes.forEach((n) => {
                errors.push(...recurrentSubgraphLoad(n));
            });

            if (errors.length) {
                return errors;
            }

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
        this.graphName = entryGraph.name;
        this.readonly = readonlySetting;

        // If the editor is run outside of a browser, then
        // all functionality that is after this line will fail,
        // as it changes the way the graph is rendered in the browser
        if (typeof window === 'undefined' || loadOnly) return errors;

        const dfs = (subgraph, path) => {
            if (subgraph?.nodes !== undefined) {
                for (let i = 0; i < subgraph.nodes.length; i += 1) {
                    if (subgraph.nodes[i].subgraph !== undefined) {
                        if (subgraph.nodes[i].subgraph.id === entryGraph.id) {
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

        try {
            path.forEach((node) => {
                this.switchToSubgraph(node);
            });
        } catch (err) {
            errors.push(err.toString());
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
        if (!preventCentering && scaling === undefined && panning === undefined) {
            this.centerZoom();
        }
        return errors;
    }

    privatizeInterface(graphId, intf) {
        if (intf.externalName === undefined) return;

        let graph = [...this.graphs].find((g) => g.id === graphId);
        let graphNode = graph.graphNode; // eslint-disable-line prefer-destructuring

        intf.externalName = undefined;
        if (graphNode === undefined) return;

        const { graphIds, sharedInterface } = ir.getRegisteredInterface(intf.id);
        const graphIdIdx = graphIds.findIndex((id) => id === graphNode.graph.id);
        graphIds.splice(graphIdIdx, graphIds.length - graphIdIdx);

        graphNode.updateExposedInterfaces();

        // Update all graphs that used this exposed interface
        for (let i = graphIdIdx + 1; i < graphIds.length; i += 1) {
            graph = [...this.graphs].find((g) => g.id === graphIds[graphIdIdx]);
            graphNode = graph.graphNode; // eslint-disable-line prefer-destructuring
            graphNode.updateExposedInterfaces();
        }

        // If sharedInterface is the same as the interface that is privatized, it means
        // that the interface is not shared anymore and its entry should be deleted.
        if (sharedInterface === intf) {
            ir.deleteRegisteredInterface(intf.id);
        }
    }

    /**
     * Exposes passed interface under the `name` name. The node that has the interface has to
     * be in the graph with the `graphId` ID.
     *
     * @param {string} graphId graph which has the node with the interface
     * @param {Object} intf interface to expose
     * @param {string} name name under which the interface will be exposed. If set to `undefined`,
     * external name will be inferred from the name of the interface.
     */
    exposeInterface(graphId, intf, name = undefined) {
        const graph = [...this.graphs].find((g) => g.id === graphId);
        const graphNode = graph.graphNode; // eslint-disable-line prefer-destructuring
        intf.externalName = name ?? graph.resolveNewExposedName(intf.name);
        if (graphNode === undefined) return;
        // After changing the external name, the interface has to be updated in the
        // graph node to reflect the changes in the graph.
        graphNode.updateExposedInterfaces();
    }

    /**
     * Calculates the width, height of the editor and the width of the sidebar.
     * It is assumed that the view is rendered in the browser,
     * otherwise an error will be thrown.
     *
     * @returns {Object} object with calculated sizes
     */
    static editorSize() {
        if (typeof document === 'undefined') {
            throw new Error('The editor is in browserless mode. Cannot obtain editor size.');
        }

        const terminalHeight =
            document.getElementsByClassName('terminal-wrapper')[0]?.offsetHeight ?? 0;
        const navbarHeight = document.getElementsByClassName('wrapper')[0]?.offsetHeight ?? 0;
        const nodePalette = document.getElementsByClassName('baklava-node-palette');
        let sideBarWidth = 0;
        if (nodePalette.length !== 0) {
            const paletteRect = nodePalette[0].getBoundingClientRect();
            sideBarWidth = Math.max(paletteRect.right, 0);
        }

        const editorHeight = window.innerHeight - terminalHeight - navbarHeight;
        const editorWidth = window.innerWidth - sideBarWidth;

        return {
            editorWidth,
            editorHeight,
            sideBarWidth,
        };
    }

    /**
     * Centers the currently displayed graph in the editor.
     * The function calculates the scaling and panning values to center the graph
     * in the editor and sets them in the graph.
     * The function assumes that the editor is rendered in the browser,
     * otherwise an error will be thrown.
     */
    centerZoom() {
        if (!Array.isArray(this._graph.nodes) || this._graph.nodes.length === 0) return;
        if (typeof document === 'undefined') {
            throw new Error('The editor is in browserless mode. Cannot obtain editor size.');
        }

        const {
            editorWidth,
            editorHeight,
            sideBarWidth,
        } = PipelineManagerEditor.editorSize();

        const {
            graphHeight,
            graphWidth,
            leftmostX,
            topmostY,
        } = this._graph.size();

        const margin = 100;

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

    nodeURLsEmpty() {
        return this.nodeURLs.size === 0;
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

    getPillText(nodeName) {
        const nodeType = this.nodeTypes.get(nodeName);
        return nodeType.pill?.text
            ?? ((nodeType?.style !== undefined || undefined)
                && this.getNodeStyle(nodeType.style)?.pill?.text);
    }

    getNodeCategory(nodeName) {
        return this.nodeTypes.get(nodeName).category || undefined;
    }

    getNodeColor(node) {
        const nodeType = this.nodeTypes.get(node.type);
        return this.nodeColors.get(node.id)
            ?? nodeType?.color
            ?? ((nodeType?.style !== undefined || undefined)
                && this.getNodeStyle(nodeType.style)?.color);
    }

    setNodeColor(nodeId, color) {
        if (color !== undefined) {
            this.nodeColors.set(nodeId, color);
        }
    }

    getStyleIcon(nodeName) {
        const nodeType = this.nodeTypes.get(nodeName);
        if (nodeType?.style !== undefined) return this.getNodeStyle(nodeType.style)?.icon;
        return undefined;
    }

    getNodeStyle(style) {
        if (!Array.isArray(style)) {
            style = [style];
        }

        return Object.assign({}, ...style
            .map((styleName) => this.nodeStyles.get(styleName))
            .filter((value) => value !== undefined));
    }

    getPillColor(nodeName) {
        const nodeType = this.nodeTypes.get(nodeName);
        return nodeType.pill?.color
            ?? ((nodeType?.style !== undefined || undefined)
                && this.getNodeStyle(nodeType.style)?.pill?.color);
    }

    /* eslint-disable class-methods-use-this */
    getTextColor(color) {
        if (color === undefined || color === '') {
            return 'white';
        }
        // calculate lightness
        const rgb = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
        const r = parseInt(rgb[1], 16) / 255;
        const g = parseInt(rgb[2], 16) / 255;
        const b = parseInt(rgb[3], 16) / 255;
        const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;

        if (lightness > 0.5) {
            return 'black';
        }

        return 'white';
    }

    isGraphNode(nodeName) {
        if (!this.nodeTypes.has(nodeName)) return false;
        return this.nodeTypes.get(nodeName).subgraphId !== undefined;
    }

    addGraphTemplate(template, graphNode) {
        if (this.events.beforeAddGraphTemplate.emit(template).prevented) {
            return;
        }
        this._graphTemplates.push(template);
        this.graphTemplateEvents.addTarget(template.events);
        this.graphTemplateHooks.addTarget(template.hooks);

        const customGraphNodeType = CreateCustomGraphNodeType(template, graphNode);
        this.registerNodeType(customGraphNodeType, {
            category: graphNode.category,
            title: graphNode.title,
            isCategory: graphNode.isCategory,
            color: graphNode.color,
            style: graphNode.style,
            pill: graphNode.pill,
            subgraphId: graphNode.subgraphId,
        });

        this.events.addGraphTemplate.emit(template);
    }

    switchGraph(subgraphNode) {
        if (this._switchGraph === undefined) {
            const { switchGraph } = useGraph();
            this._switchGraph = switchGraph;
        }
        // disable history logging for the switch - don't push nodes being created here
        suppressHistoryLogging(true);

        if (subgraphNode.subgraph === undefined) {
            throw Error(
                `Node "${subgraphNode.name}" does contain a subgraph.`,
            );
        }
        this._graph = subgraphNode.subgraph;
        this._switchGraph(subgraphNode.subgraph);
        this.graphName = this._graph.name;

        suppressHistoryLogging(false);
        nextTick().then(() => {
            const graph = this.graph.save();
            this.layoutManager.registerGraph(graph);
            this.layoutManager
                .computeLayout(graph)
                .then(this.updateNodesPosition.bind(this))
                .then(() => {
                    nextTick().then(() => {
                        if (
                            !this._graph.wasCentered
                        ) {
                            this.centerZoom();
                            this._graph.wasCentered = true;
                        }
                    });
                });
        });
    }

    /**
    * Switch to a subgraph by obtaining the current graph from the subgraph node
    * and pushing the subgraph node to the stack.
    *
    * @param {Node} subgraphNode A subgraph node containing a subgraph,
    * to which a layout should be switched.
    * */
    switchToSubgraph(subgraphNode) {
        if (subgraphNode && subgraphNode.subgraph) {
            this.subgraphStack.push(subgraphNode.graph);
            this.switchGraph(subgraphNode);
        }
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
        const newGraph = this.subgraphStack.pop(); // eslint-disable-line no-unused-vars

        suppressHistoryLogging(true);

        this._graph = newGraph;
        this._switchGraph(this._graph);
        this.graphName = this._graph.name;

        suppressHistoryLogging(false);
    }

    findInterface(intfId) {
        for (let i = 0; i < this.graph.nodes.length; i += 1) {
            const foundIntf = Object.values(this.graph.nodes[i].inputs).concat(
                Object.values(this.graph.nodes[i].outputs),
            ).find(
                (intf) => intf.id === intfId,
            );
            if (foundIntf) return foundIntf;
        }
        return null;
    }

    unwrapSubgraph(node) {
        const subgraphNodes = Object.values(node.subgraph._nodes);
        // Calculate center point of subgraph nodes
        const meanX = subgraphNodes.map((n) => n.position.x).reduce(
            (sum, value) => sum + value, 0,
        ) / subgraphNodes.length;
        const meanY = subgraphNodes.map((n) => n.position.y).reduce(
            (sum, value) => sum + value, 0,
        ) / subgraphNodes.length;
        // Remove selections
        this.graph.selectedNodes = [];
        // Create, reposition and select subgraph nodes
        subgraphNodes.forEach((subgraphNode) => {
            const state = subgraphNode.save();
            const addedNode = this.graph.addNode(subgraphNode);
            if (addedNode) {
                // Set position relative to removed node
                addedNode.position.x += node.position.x - meanX;
                addedNode.position.y += node.position.y - meanY;
                this.graph.selectedNodes.push(addedNode);
                // Reset connections count
                Object.values(addedNode.inputs).concat(
                    Object.values(addedNode.outputs),
                ).forEach(
                    (intf) => { intf.connectionCount = 0; },
                );
                addedNode.load(state);
            }
        });

        const subgraphNodeConnections = this.graph.connections.filter(
            (c) => c.from.nodeId === node.id || c.to.nodeId === node.id,
        );
        this.graph.removeNode(node);
        Object.values(node.subgraph.connections).concat(
            subgraphNodeConnections,
        ).forEach((connection) => {
            if (connection.from.name === 'Connection' || connection.to.name === 'Connection') { return; }

            // Finding interfaces in newly added nodes that correspond to the ones in the connection
            const fromInterface = this.findInterface(connection.from.id);
            const toInterface = this.findInterface(connection.to.id);

            if (fromInterface && toInterface) {
                const createdConnection = this.graph.addConnection(fromInterface, toInterface);
                (connection.anchors ?? []).forEach((anchor, index) => {
                    let newAnchor;
                    // Only anchors from within the graph node should be shifted
                    if (node.subgraph.connections.includes(connection)) {
                        newAnchor = {
                            x: anchor.x + node.position.x - meanX,
                            y: anchor.y + node.position.y - meanY,
                        };
                    } else {
                        newAnchor = {
                            x: anchor.x,
                            y: anchor.y,
                        };
                    }

                    this.graph.addAnchor(newAnchor, createdConnection, index);
                });
            }
        });
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

    updateCurrentSubgraphName(name) {
        this._graph.name = name;
    }
}
