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
    createGraphNodeType,
    GRAPH_NODE_TYPE_PREFIX,
    NodeInterface,
} from '@baklavajs/core';

import { useGraph } from '@baklavajs/renderer-vue';

import { v4 as uuidv4 } from 'uuid';
import { toRaw, nextTick } from 'vue';
import {
    SUBGRAPH_OUTPUT_NODE_TYPE,
    SUBGRAPH_INPUT_NODE_TYPE,
    SUBGRAPH_INOUT_NODE_TYPE,
    SubgraphInoutNode,
    SubgraphInputNode,
    SubgraphOutputNode,
} from './subgraphInterface';
import createPipelineManagerGraph from './CustomGraph';
import LayoutManager from '../core/LayoutManager';
import { suppressHistoryLogging } from '../core/History.ts';

/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
export default class PipelineManagerEditor extends Editor {
    readonly = false;

    allowLoopbacks = false;

    nodeIcons = new Map();

    baseURLs = new Map();

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
        const stackCopy = Array.from(toRaw(this.subgraphStack));
        stackCopy.forEach(this.backFromSubgraph.bind(this));

        const state = super.save();
        delete state.graphTemplates;
        state.graph.panning = this._graph.panning;
        state.graph.scaling = this._graph.scaling;
        state.graphTemplateInstances = [];
        // subgraphs are stored in state.graphTemplateInstances, there is no need to store it
        // in nodes itself
        const recurrentSubgraphSave = (node) => {
            if (node.type.startsWith(GRAPH_NODE_TYPE_PREFIX)) {
                node.type = node.type.slice(GRAPH_NODE_TYPE_PREFIX.length);
                node.subgraph = node.graphState.id;
                state.graphTemplateInstances.push(node.graphState);
                node.graphState.nodes.forEach(recurrentSubgraphSave);
            }
            delete node.graphState;
        };
        state.graph.nodes.forEach(recurrentSubgraphSave);

        /* eslint-disable no-unused-vars */
        stackCopy.forEach(([_, subgraphNode]) => {
            const errors = this.switchToSubgraph(subgraphNode);
            if (Array.isArray(errors) && errors.length) {
                throw new Error(errors);
            }
        });
        /* eslint-enable no-unused-vars */

        // Main graph should have no IO
        delete state.graph.inputs;
        delete state.graph.outputs;

        return state;
    }

    /**
     * Cleans up the editor.
     *
     * Removes all nodes and connections from the editor and unregisters all
     * nodes. Its important that registered interface types are not removed, as there
     * is no support for that in baklavajs, but it should not result in any malfunction.
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

        // There can be only one subgraph node matching to a particular graphTemplateInstances
        const usedInstances = new Set();

        const recurrentSubgraphLoad = (node) => {
            if (node.subgraph !== undefined) {
                const fittingTemplate = state.graphTemplateInstances.filter(
                    (template) => template.id === node.subgraph,
                );
                if (fittingTemplate.length !== 1) {
                    throw new Error(
                        `Expected exactly one template with ID ${node.type}, got ${fittingTemplate.length}`,
                    );
                }
                if (usedInstances.has(node.subgraph)) {
                    throw new Error(
                        `Subgraph ${node.subgraph} has multiple nodes pointing to it - only unique IDs are allowed`,
                    );
                }
                usedInstances.add(node.subgraph);
                node.graphState = structuredClone(fittingTemplate[0]);
                node.graphState.nodes.forEach(recurrentSubgraphLoad);
                node.type = `${GRAPH_NODE_TYPE_PREFIX}${node.type}`;

                // create GraphState inputs/outputs by matching interfaces in a correct direction
                // from node interfaces to subgraphIO
                node.graphState.inputs = node.interfaces
                    .filter((intf) => intf.direction === 'input' || intf.direction === 'inout')
                    .map(
                        (intf) => node.graphState.subgraphIO.filter((io) => intf.name === io.id)[0],
                    );
                node.graphState.outputs = node.interfaces
                    .filter((intf) => intf.direction === 'output')
                    .map(
                        (intf) => node.graphState.subgraphIO.filter((io) => intf.name === io.id)[0],
                    );
                delete node.graphState.subgraphIO;

                delete node.subgraph;
            }
        };

        // Load the node state as it is, wait until vue renders new nodes so that
        // node dimensions can be retrieved from DOM elements and then update the
        // location based on autolayout results. The editor is set to readonly
        // during loading to prevent any changes that may happen between graph load
        // and layout computation
        const readonlySetting = this.readonly;
        this.readonly = true;
        let errors = [];
        try {
            state.graph.nodes.forEach(recurrentSubgraphLoad);
            state.graphTemplates = [];
            state.graph.inputs = [];
            state.graph.outputs = [];
            this.layoutManager.registerGraph(state.graph);

            errors = super.load(state);
        } catch (err) {
            // If anything goes wrong during dataflow loading, the editor is cleaned and an
            // appropriate error is returned.
            this.cleanEditor();
            this.readonly = readonlySetting;
            return [err.toString()];
        }

        if (Array.isArray(errors) && errors.length) {
            this.cleanEditor();
            this.readonly = readonlySetting;
            return errors;
        }
        await nextTick();
        const updatedGraph = await this.layoutManager.computeLayout(state.graph);
        this.updateNodesPosition(updatedGraph);
        this.readonly = readonlySetting;

        // We need sidebar rendered for autozoom
        await nextTick();

        if (state.graph.panning !== undefined) {
            this._graph.panning = state.graph.panning;
        }
        if (state.graph.scaling !== undefined) {
            this._graph.scaling = state.graph.scaling;
        }
        if (state.graph.scaling === undefined && state.graph.panning === undefined) {
            this.centerZoom();
        }

        return [];
    }

    centerZoom() {
        if (!Array.isArray(this._graph.nodes) || this._graph.nodes.length === 0) return;
        if (typeof document === 'undefined') {
            return;
        }

        const sizes = this._graph.nodes.map((node) => {
            const HTMLelement = document.getElementById(node.id);
            return {
                width: HTMLelement.offsetWidth,
                height: HTMLelement.offsetHeight,
                position: node.position,
            };
        });

        const margin = 100;
        const terminalHeight =
            document.getElementsByClassName('terminal-wrapper')[0]?.offsetHeight ?? 0;
        const navbarHeight = document.getElementsByClassName('wrapper')[0]?.offsetHeight ?? 0;
        const sideBarWidth =
            document.getElementsByClassName('baklava-node-palette')[0]?.offsetWidth ?? 0;

        const rightmostX = Math.max(...sizes.map((node) => node.position.x + node.width)) + margin;
        const leftmostX = Math.min(...sizes.map((node) => node.position.x)) - margin;

        const bottommostY =
            Math.max(...sizes.map((node) => node.position.y + node.height)) + margin;
        const topmostY = Math.min(...sizes.map((node) => node.position.y)) - margin;

        const graphWidth = rightmostX - leftmostX;
        const graphHeight = bottommostY - topmostY;

        const editorHeight = window.innerHeight - terminalHeight - navbarHeight;
        const editorWidth = window.innerWidth - sideBarWidth;

        const scalingY = editorHeight / graphHeight;
        const scalingX = editorWidth / graphWidth;

        if (scalingX > scalingY) {
            const graphCenter = graphWidth / 2;
            const editorCenter = (editorWidth / 2) * (1 / scalingY);

            const translationX = editorCenter - graphCenter;

            this._graph.panning = {
                x: -(leftmostX - translationX - sideBarWidth / scalingY),
                y: -topmostY,
            };
            this._graph.scaling = scalingY;
        } else {
            const graphCenter = graphHeight / 2;
            const editorCenter = (editorHeight / 2) * (1 / scalingX);

            const translationY = editorCenter - graphCenter;

            this._graph.panning = {
                x: -(leftmostX - sideBarWidth / scalingX),
                y: -(topmostY - translationY),
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

        const nt = createGraphNodeType(template);
        class customGraphNodeType extends nt {
            constructor() {
                super();
                this.type = `${GRAPH_NODE_TYPE_PREFIX}${type}`;
            }

            save() {
                const state = super.save();
                const inputInterfaceMap = new Map();
                Object.values(this.inputs).forEach((input) =>
                    inputInterfaceMap.set(input.id, input),
                );
                const inputInterfaces = Object.entries(state.inputs).map(([key, value]) => ({
                    id: value.id,
                    name: key,
                    direction: inputInterfaceMap.get(value.id).direction,
                    side: inputInterfaceMap.get(value.id).side,
                    nodePosition: inputInterfaceMap.get(value.id).nodePosition,
                }));
                const outputInterfaceMap = new Map();
                Object.values(this.outputs).forEach((output) =>
                    outputInterfaceMap.set(output.id, output),
                );
                const outputInterfaces = Object.entries(state.outputs)
                    .filter((key) => key[0] !== '_calculationResults')
                    .map(([key, value]) => ({
                        id: value.id,
                        name: key,
                        direction: 'output',
                        side: outputInterfaceMap.get(value.id).side,
                        nodePosition: outputInterfaceMap.get(value.id).nodePosition,
                    }));
                delete state.inputs;
                delete state.outputs;

                // After entering the edit subgraph mode, subgraph interfaces will contain
                // redundant information, such as side, nodePosition etc.
                // (these are already defined in state.interfaces) so they should be filtered out
                state.graphState.subgraphIO = [];
                state.graphState.inputs.forEach((input) =>
                    state.graphState.subgraphIO.push({
                        id: input.id,
                        name: input.name,
                        nodeInterfaceId: input.nodeInterfaceId,
                    }),
                );
                state.graphState.outputs.forEach((output) =>
                    state.graphState.subgraphIO.push({
                        id: output.id,
                        name: output.name,
                        nodeInterfaceId: output.nodeInterfaceId,
                    }),
                );

                return { ...state, interfaces: inputInterfaces.concat(outputInterfaces) };
            }

            load(state) {
                const inputs = {};
                state.interfaces
                    .filter((intf) => intf.direction === 'input' || intf.direction === 'inout')
                    .forEach((intf) => {
                        inputs[intf.name] = {
                            id: intf.id,
                            direction: intf.direction,
                            side: intf.side,
                            nodePosition: intf.nodePosition,
                        };
                    });
                const outputs = { _calculationResults: { id: uuidv4 } };
                state.interfaces
                    .filter((intf) => intf.direction === 'output')
                    .forEach((intf) => {
                        outputs[intf.name] = {
                            id: intf.id,
                            direction: intf.direction,
                            side: intf.side,
                            nodePosition: intf.nodePosition,
                        };
                    });

                /*
                    When the subgraph node is created, it creates a placeholder interfaces
                    which are later loaded by super.load, setting proper names and IDs.
                    The name of interface is an ID of input/output in a subgraph (except for
                    '_calculationResults`, which is baklava specific hidden output). IDs of
                    inputs/outputs are also randomly generated IDs, which are later updated, but
                    the names of are not adjusted. We need to tie an input interface with
                    corresponding subgraph input (here it is done by name of subgraph input) and
                    adjust the node's input (and likewise for outputs)

                */
                const inputMap = new Map();
                state.graphState.inputs.forEach((input) => {
                    inputMap.set(input.id, input.name);
                });
                Object.keys(this.inputs).forEach((key) => {
                    this.removeInterface('input', key);
                });
                Object.entries(inputs).forEach(([inputID, inputInfo]) => {
                    const ni = new NodeInterface(inputMap.get(inputID), undefined);
                    ni.id = inputInfo.id;
                    ni.direction = inputInfo.direction;
                    ni.side = inputInfo.side;
                    ni.nodePosition = inputInfo.nodePosition;
                    this.addInterface('input', inputID, ni);
                });
                const outputMap = new Map();
                state.graphState.outputs.forEach((output) => {
                    outputMap.set(output.id, output.name);
                });
                Object.keys(this.outputs).forEach((key) => {
                    this.removeInterface('output', key);
                });
                Object.entries(outputs).forEach(([outputID, outputInfo]) => {
                    const ni = new NodeInterface(outputMap.get(outputID), undefined);
                    ni.id = outputInfo.id;
                    ni.direction = outputInfo.direction;
                    ni.side = outputInfo.side;
                    ni.nodePosition = outputInfo.nodePosition;
                    this.addInterface('output', outputID, ni);
                });

                delete state.interfaces;
                super.load({ ...state, inputs, outputs });
                // Default position should be undefined instead of (0, 0) so that it can be set
                // by autolayout
                if (state.position === undefined) {
                    this.position = undefined;
                }
            }

            updateInterfaces() {
                super.updateInterfaces();
                this.template.inputs.forEach((ni) => {
                    this.inputs[ni.id].direction = ni.direction ? ni.direction : 'input';
                    this.inputs[ni.id].side = ni.side ? ni.side : 'left';
                    this.inputs[ni.id].nodePosition = ni.nodePosition ? ni.nodePosition : undefined;
                });
                this.template.outputs.forEach((ni) => {
                    this.outputs[ni.id].direction = 'output';
                    this.outputs[ni.id].side = ni.side ? ni.side : 'right';
                    this.outputs[ni.id].nodePosition = ni.nodePosition
                        ? ni.nodePosition
                        : undefined;
                });
            }
        }
        this.registerNodeType(customGraphNodeType, { category, title: template.name });

        this.events.addGraphTemplate.emit(template);
    }

    switchGraph(subgraphNode) {
        if (this._switchGraph === undefined) {
            const { switchGraph } = useGraph();
            this._switchGraph = switchGraph;
        }
        // disable history logging for the switch - don't push nodes being created here
        suppressHistoryLogging(true);

        this._graph = subgraphNode.subgraph;
        const errors = [];

        const convertToUpperCase = (str) => `${str[0].toUpperCase()}${str.slice(1)}`;

        Object.entries(subgraphNode.inputs)
            .filter((input) => input[1].direction === 'input')
            .forEach(([interfaceID, input]) => {
                const node = new SubgraphInputNode();
                node.inputs.name.value = input.name;
                node.inputs.side.value = convertToUpperCase(input.side);
                node.graphInterfaceId = interfaceID;
                this._graph.addNode(node);
                node.position = input.nodePosition;

                // NodeInterfaceID is stored only in template, we need to find it by ID
                const templateInputArr = Object.values(this._graph.inputs).filter(
                    (intf) => intf.id === interfaceID,
                );
                if (templateInputArr.length !== 1) {
                    errors.push([
                        `Error when creating subgraph ${this._graph.id}: Expected 1 interface with ID ${interfaceID}, got ${templateInputArr.length}`,
                    ]);
                    suppressHistoryLogging(false);
                    return;
                }
                const templateInput = templateInputArr[0];
                const targetInterface = this._graph.findNodeInterface(
                    templateInput.nodeInterfaceId,
                );
                if (!targetInterface) {
                    errors.push([
                        `Error when creating subgraph ${this._graph.id}: Could not find interface ${templateInput.nodeInterfaceId} in subgraph`,
                    ]);
                    suppressHistoryLogging(false);
                    return;
                }
                this._graph.addConnection(node.outputs.placeholder, targetInterface);
            });

        Object.entries(subgraphNode.inputs)
            .filter((inout) => inout[1].direction === 'inout')
            .forEach(([interfaceID, inout]) => {
                const node = new SubgraphInoutNode();
                node.inputs.name.value = inout.name;
                node.inputs.side.value = convertToUpperCase(inout.side);
                node.graphInterfaceId = interfaceID;
                this._graph.addNode(node);
                node.position = inout.nodePosition;
                const templateInoutArr = Object.values(this._graph.inputs).filter(
                    (intf) => intf.id === interfaceID,
                );
                if (templateInoutArr.length !== 1) {
                    errors.push([
                        `Error when creating subgraph ${this._graph.id}: Expected 1 interface with ID ${interfaceID}, got ${templateInoutArr.length}`,
                    ]);
                    suppressHistoryLogging(false);
                    return;
                }
                const templateInout = templateInoutArr[0];
                const targetInterface = this._graph.findNodeInterface(
                    templateInout.nodeInterfaceId,
                );
                if (!targetInterface) {
                    errors.push([
                        `Error when creating subgraph ${this._graph.id}: Could not find interface ${templateInout.nodeInterfaceId} in subgraph`,
                    ]);
                    suppressHistoryLogging(false);
                    return;
                }
                this._graph.addConnection(targetInterface, node.inputs.placeholder);
            });

        Object.entries(subgraphNode.outputs)
            .filter(([name, outputIntf]) => name !== '_calculationResults') // eslint-disable-line no-unused-vars
            .forEach(([interfaceID, output]) => {
                const node = new SubgraphOutputNode();
                node.inputs.name.value = output.name;
                node.inputs.side.value = convertToUpperCase(output.side);
                node.graphInterfaceId = interfaceID;
                this._graph.addNode(node);
                node.position = output.nodePosition;
                const templateOutputArr = Object.values(this._graph.outputs).filter(
                    (intf) => intf.id === interfaceID,
                );
                if (templateOutputArr.length !== 1) {
                    errors.push([
                        `Error when creating subgraph ${this._graph.id}: Expected 1 interface with ID ${interfaceID}, got ${templateOutputArr.length}`,
                    ]);
                    suppressHistoryLogging(false);
                    return;
                }
                const templateOutput = templateOutputArr[0];
                const targetInterface = this._graph.findNodeInterface(
                    templateOutput.nodeInterfaceId,
                );
                if (!targetInterface) {
                    errors.push([
                        `Error when creating subgraph ${this._graph.id}: Could not find interface ${templateOutput.nodeInterfaceId} in subgraph`,
                    ]);
                    suppressHistoryLogging(false);
                    return;
                }
                this._graph.addConnection(targetInterface, node.inputs.placeholder);
            });

        this._switchGraph(this._graph);
        suppressHistoryLogging(false);
        nextTick().then(() => {
            const graph = this.graph.save();
            this.layoutManager.registerGraph(graph);
            this.layoutManager.computeLayout(graph).then(this.updateNodesPosition.bind(this));
        });
        return errors;
    }

    switchToSubgraph(subgraphNode) {
        this.subgraphStack.push([this._graph.id, subgraphNode]);
        this.switchGraph(subgraphNode);
    }

    backFromSubgraph() {
        const [newGraphId, subgraphNode] = this.subgraphStack.pop();
        const newGraph = [...this.graphs].filter((graph) => graph.id === newGraphId)[0];

        suppressHistoryLogging(true);

        this._graph.updateTemplate();
        this._graph.inputs = this._graph.template.inputs;
        this._graph.outputs = this._graph.template.outputs;
        subgraphNode.updateInterfaces();
        this._graph.nodes
            .filter((node) =>
                [
                    SUBGRAPH_INPUT_NODE_TYPE,
                    SUBGRAPH_OUTPUT_NODE_TYPE,
                    SUBGRAPH_INOUT_NODE_TYPE,
                ].includes(node.type),
            )
            .forEach((node) => this._graph.removeNode(node));

        this._graph = newGraph;
        this._switchGraph(this._graph);

        suppressHistoryLogging(false);
    }

    isInSubgraph() {
        return this.subgraphStack.length > 0;
    }

    async applyAutolayout() {
        const state = this.graph.save();
        state.nodes.forEach((node) => {
            node.position = undefined;
        });
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
