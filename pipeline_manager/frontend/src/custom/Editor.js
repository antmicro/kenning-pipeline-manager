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
    useGraph,
    GRAPH_NODE_TYPE_PREFIX,
    NodeInterface,
} from 'baklavajs';
import { v4 as uuidv4 } from 'uuid';
import { toRaw } from 'vue';
import {
    SUBGRAPH_OUTPUT_NODE_TYPE,
    SUBGRAPH_INPUT_NODE_TYPE,
    SUBGRAPH_INOUT_NODE_TYPE,
    SubgraphInoutNode,
    SubgraphInputNode,
    SubgraphOutputNode,
} from './subgraphInterface';
import NotificationHandler from '../core/notifications';
import createPipelineManagerGraph from './CustomGraph';

/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
export default class PipelineManagerEditor extends Editor {
    readonly = false;

    hideHud = false;

    allowLoopbacks = false;

    nodeIcons = new Map();

    baseURLs = new Map();

    nodeURLs = new Map();

    subgraphStack = [];

    registerGraph(graph) {
        const customGraph = createPipelineManagerGraph(graph);
        super.registerGraph(customGraph);
    }

    save() {
        // Save all changes done to subgraphs before saving
        // const stackCopy = structuredClone(toRaw(this.subgraphStack))
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
        stackCopy.forEach(([_, subgraphNode]) => this.switchToSubgraph(subgraphNode));
        /* eslint-enable no-unused-vars */

        // Main graph should have no IO
        delete state.graph.inputs;
        delete state.graph.outputs;

        return state;
    }

    load(state) {
        // All subgraphs should be unregistered to avoid conflicts later when trying to
        // load into subgraph (in that case there may be two subgraphs with the same ID, one
        // of them from the previous session).
        [...this.graphs]
            .filter((graph) => graph.id !== this._graph.id)
            .forEach((graph) => this.unregisterGraph(graph));
        this.subgraphStack = [];

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

        state.graph.nodes.forEach(recurrentSubgraphLoad);
        state.graphTemplates = [];
        state.graph.inputs = [];
        state.graph.outputs = [];

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
                    connectionSide: inputInterfaceMap.get(value.id).connectionSide,
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
                        connectionSide: outputInterfaceMap.get(value.id).connectionSide,
                        nodePosition: outputInterfaceMap.get(value.id).nodePosition,
                    }));
                delete state.inputs;
                delete state.outputs;

                // After entering the edit subgraph mode, subgraph interfaces will contain
                // redundant information, such as connectionSide, nodePosition etc.
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
                delete state.graphState.inputs;
                delete state.graphState.outputs;

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
                            connectionSide: intf.connectionSide,
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
                            connectionSide: intf.connectionSide,
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
                    ni.connectionSide = inputInfo.connectionSide;
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
                    ni.connectionSide = outputInfo.connectionSide;
                    ni.nodePosition = outputInfo.nodePosition;
                    this.addInterface('output', outputID, ni);
                });

                delete state.interfaces;
                super.load({ ...state, inputs, outputs });
            }

            updateInterfaces() {
                super.updateInterfaces();
                this.template.inputs.forEach((ni) => {
                    this.inputs[ni.id].direction = ni.direction ? ni.direction : 'input';
                    this.inputs[ni.id].connectionSide = ni.connectionSide
                        ? ni.connectionSide
                        : 'left';
                    this.inputs[ni.id].nodePosition = ni.nodePosition ? ni.nodePosition : undefined;
                });
                this.template.outputs.forEach((ni) => {
                    this.outputs[ni.id].direction = 'output';
                    this.outputs[ni.id].connectionSide = ni.connectionSide
                        ? ni.connectionSide
                        : 'right';
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
        this._graph = subgraphNode.subgraph;

        const convertToUpperCase = (str) => `${str[0].toUpperCase()}${str.slice(1)}`;

        Object.entries(subgraphNode.inputs)
            .filter((input) => input[1].direction === 'input')
            .forEach(([interfaceID, input]) => {
                const node = new SubgraphInputNode();
                node.inputs.name.value = input.name;
                node.inputs.connectionSide.value = convertToUpperCase(input.connectionSide);
                node.graphInterfaceId = interfaceID;
                node.position = input.nodePosition;
                this._graph.addNode(node);

                // NodeInterfaceID is stored only in template, we need to find it by ID
                const templateInputArr = Object.values(this._graph.inputs).filter(
                    (intf) => intf.id === interfaceID,
                );
                if (templateInputArr.length !== 1) {
                    NotificationHandler.showToast(
                        'error',
                        `Error when creating subgraph ${this._graph.id}: Expected 1 interface with ID ${interfaceID}, got ${templateInputArr.length}`,
                    );
                    return;
                }
                const templateInput = templateInputArr[0];
                const targetInterface = this._graph.findNodeInterface(
                    templateInput.nodeInterfaceId,
                );
                if (!targetInterface) {
                    NotificationHandler.showToast(
                        'error',
                        `Error when creating subgraph ${this._graph.id}: Could not find interface ${templateInput.nodeInterfaceId} in subgraph`,
                    );
                    return;
                }
                this._graph.addConnection(node.outputs.placeholder, targetInterface);
            });

        Object.entries(subgraphNode.inputs)
            .filter((inout) => inout[1].direction === 'inout')
            .forEach(([interfaceID, inout]) => {
                const node = new SubgraphInoutNode();
                node.inputs.name.value = inout.name;
                node.inputs.connectionSide.value = convertToUpperCase(inout.connectionSide);
                node.graphInterfaceId = interfaceID;
                node.position = inout.nodePosition;
                this._graph.addNode(node);
                const templateInoutArr = Object.values(this._graph.inputs).filter(
                    (intf) => intf.id === interfaceID,
                );
                if (templateInoutArr.length !== 1) {
                    NotificationHandler.showToast(
                        'error',
                        `Error when creating subgraph ${this._graph.id}: Expected 1 interface with ID ${interfaceID}, got ${templateInoutArr.length}`,
                    );
                    return;
                }
                const templateInout = templateInoutArr[0];
                const targetInterface = this._graph.findNodeInterface(
                    templateInout.nodeInterfaceId,
                );
                if (!targetInterface) {
                    NotificationHandler.showToast(
                        'error',
                        `Error when creating subgraph ${this._graph.id}: Could not find interface ${templateInout.nodeInterfaceId} in subgraph`,
                    );
                    return;
                }
                this._graph.addConnection(targetInterface, node.inputs.placeholder);
            });

        Object.entries(subgraphNode.outputs)
            .filter(([name, outputIntf]) => name !== '_calculationResults') // eslint-disable-line no-unused-vars
            .forEach(([interfaceID, output]) => {
                const node = new SubgraphOutputNode();
                node.inputs.name.value = output.name;
                node.inputs.connectionSide.value = convertToUpperCase(output.connectionSide);
                node.graphInterfaceId = interfaceID;
                node.position = output.nodePosition;
                this._graph.addNode(node);
                const templateOutputArr = Object.values(this._graph.outputs).filter(
                    (intf) => intf.id === interfaceID,
                );
                if (templateOutputArr.length !== 1) {
                    NotificationHandler.showToast(
                        'error',
                        `Error when creating subgraph ${this._graph.id}: Expected 1 interface with ID ${interfaceID}, got ${templateOutputArr.length}`,
                    );
                    return;
                }
                const templateOutput = templateOutputArr[0];
                const targetInterface = this._graph.findNodeInterface(
                    templateOutput.nodeInterfaceId,
                );
                if (!targetInterface) {
                    NotificationHandler.showToast(
                        'error',
                        `Error when creating subgraph ${this._graph.id}: Could not find interface ${templateOutput.nodeInterfaceId} in subgraph`,
                    );
                    return;
                }
                this._graph.addConnection(targetInterface, node.inputs.placeholder);
            });

        this._switchGraph(this._graph);
    }

    switchToSubgraph(subgraphNode) {
        this.subgraphStack.push([this._graph.id, subgraphNode]);
        this.switchGraph(subgraphNode);
    }

    backFromSubgraph() {
        const [newGraphId, subgraphNode] = this.subgraphStack.pop();
        const newGraph = [...this.graphs].filter((graph) => graph.id === newGraphId)[0];

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
    }

    isInSubgraph() {
        return this.subgraphStack.length > 0;
    }
}
