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
    DummyConnection,
    createGraphNodeType,
    useGraph,
    GraphTemplate,
    GRAPH_NODE_TYPE_PREFIX,
    NodeInterface,
} from 'baklavajs';
import { v4 as uuidv4 } from 'uuid';
import { parseNodeState } from '../core/NodeFactory';
import {
    SUBGRAPH_OUTPUT_NODE_TYPE,
    SUBGRAPH_INPUT_NODE_TYPE,
    SUBGRAPH_INOUT_NODE_TYPE,
    SubgraphInoutNode,
    SubgraphInputNode,
    SubgraphOutputNode,
} from './subgraphInterface';

export default class PipelineManagerEditor extends Editor {
    readonly = false;

    hideHud = false;

    allowLoopbacks = false;

    nodeIcons = new Map();

    baseURLs = new Map();

    nodeURLs = new Map();

    subgraphStack = [];

    /* eslint-disable no-param-reassign */
    /* eslint-disable no-underscore-dangle */
    constructor() {
        super();
        this.registerNodeType(SubgraphInputNode, { category: 'Subgraphs' });
        this.registerNodeType(SubgraphOutputNode, { category: 'Subgraphs' });
        this.registerNodeType(SubgraphInoutNode, { category: 'Subgraphs' });
    }

    registerGraph(graph) {
        graph.checkConnection = function checkConnection(from, to) {
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

        graph.updateTemplate = function updateTemplate() {
            const inputs = [];
            const inputNodes = this.nodes.filter((n) => n.type === SUBGRAPH_INPUT_NODE_TYPE);
            inputNodes.forEach((n) => {
                const connections = this.connections.filter(
                    (c) => c.from === n.outputs.placeholder,
                );
                connections.forEach((c) => {
                    inputs.push({
                        id: n.graphInterfaceId,
                        name: n.inputs.name.value,
                        nodeInterfaceId: c.to.id,
                        connectionSide: n.inputs.connectionSide.value.toLowerCase(),
                        direction: 'input',
                        nodePosition: n.position,
                    });
                });
            });

            const outputs = [];
            const outputNodes = this.nodes.filter((n) => n.type === SUBGRAPH_OUTPUT_NODE_TYPE);
            outputNodes.forEach((n) => {
                const connections = this.connections.filter((c) => c.to === n.inputs.placeholder);
                connections.forEach((c) => {
                    outputs.push({
                        id: n.graphInterfaceId,
                        name: n.inputs.name.value,
                        nodeInterfaceId: c.from.id,
                        connectionSide: n.inputs.connectionSide.value.toLowerCase(),
                        direction: 'output',
                        nodePosition: n.position,
                    });
                });
            });

            const inoutNodes = this.nodes.filter((n) => n.type === SUBGRAPH_INOUT_NODE_TYPE);
            inoutNodes.forEach((n) => {
                // Inout interface can be both from and to
                const connectionsTo = this.connections.filter((c) => c.to === n.inputs.placeholder);
                connectionsTo.forEach((c) => {
                    inputs.push({
                        id: n.graphInterfaceId,
                        name: n.inputs.name.value,
                        nodeInterfaceId: c.from.id,
                        connectionSide: n.inputs.connectionSide.value.toLowerCase(),
                        direction: 'inout',
                        nodePosition: n.position,
                    });
                });
                const connectionsFrom = this.connections.filter(
                    (c) => c.from === n.inputs.placeholder,
                );
                connectionsFrom.forEach((c) => {
                    inputs.push({
                        id: n.graphInterfaceId,
                        name: n.inputs.name.value,
                        nodeInterfaceId: c.to.id,
                        connectionSide: n.inputs.connectionSide.value.toLowerCase(),
                        direction: 'inout',
                        nodePosition: n.position,
                    });
                });
            });

            this.template.inputs = inputs;
            this.template.outputs = outputs;
        };

        graph.addNode = function addNode(node) {
            if (this.events.beforeAddNode.emit(node).prevented) {
                return;
            }
            this.nodeEvents.addTarget(node.events);
            this.nodeHooks.addTarget(node.hooks);
            node.registerGraph(this);

            if (node.template !== undefined) {
                const newState = {
                    id: node.template.id ?? uuidv4(),
                    nodes: node.template.nodes,
                    connections: node.template.connections,
                    inputs: node.template.inputs,
                    outputs: node.template.outputs,
                    name: node.template.name,
                };
                node.template = new GraphTemplate(newState, this.editor);
            }

            this._nodes.push(node);
            // when adding the node to the array, it will be made reactive by Vue.
            // However, our current reference is the non-reactive version.
            // Therefore, we need to get the reactive version from the array.
            node = this.nodes.find((n) => n.id === node.id);
            node.onPlaced();
            this.events.addNode.emit(node);
            return node; // eslint-disable-line consistent-return
        };

        graph.destroy = function destroy() {
            // Remove possibility of removing graphs - this ignores changes made by
            // default switchGraph (unregistering from editor and removing nodes) and
            // allows to later reuse this instance
        };

        super.registerGraph(graph);
    }

    save() {
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
                node.graphState.nodes.forEach(recurrentSubgraphSave)
            }
            delete node.graphState;
        }
        state.graph.nodes.forEach(recurrentSubgraphSave);

        return state;
    }

    load(state) {
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
                node.graphState = structuredClone(fittingTemplate[0]);
                node.graphState.nodes.forEach(recurrentSubgraphLoad);
                node.type = `${GRAPH_NODE_TYPE_PREFIX}${node.type}`;
                delete node.subgraph;
            }
        }

        state.graph.nodes.forEach(recurrentSubgraphLoad);
        state.graphTemplates = [];

        super.load(state);
        const recurrentSubgraphParse = (node, graph) => {
            if (node.graphState !== undefined) {
                const graphs = [...this.graphs].filter(graph => graph.id === node.graphState.id)
                graphs.forEach(subgraph => {
                    node.graphState.nodes.forEach(subnode => recurrentSubgraphParse(subnode, subgraph))
                })
                const graphNode = graph.nodes.filter(n => n.id === node.id)[0]
                const newState = {
                    inputs: node.graphState.inputs,
                    outputs: node.graphState.outputs,
                    connections: node.graphState.connections,
                    nodes: node.graphState.nodes.map(parseNodeState),
                    id: graphNode.template.id,
                    name: graphNode.template.name,
                };
                graphNode.template.update(newState);
            }
        };
        state.graph.nodes.forEach(node => recurrentSubgraphParse(node, this._graph))
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
        class stuff extends nt {
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
                this.inputs = {};
                Object.entries(inputs).forEach(([inputID, inputInfo]) => {
                    const ni = new NodeInterface(inputMap.get(inputID), undefined);
                    ni.id = inputInfo.id;
                    ni.direction = inputInfo.direction;
                    ni.connectionSide = inputInfo.connectionSide;
                    ni.nodePosition = inputInfo.nodePosition;
                    this.inputs[inputID] = ni;
                });
                const outputMap = new Map();
                state.graphState.outputs.forEach((output) => {
                    outputMap.set(output.id, output.name);
                });
                this.outputs = {};
                Object.entries(outputs).forEach(([outputID, outputInfo]) => {
                    const ni = new NodeInterface(outputMap.get(outputID), undefined);
                    ni.id = outputInfo.id;
                    ni.direction = outputInfo.direction;
                    ni.connectionSide = outputInfo.connectionSide;
                    ni.nodePosition = outputInfo.nodePosition;
                    this.outputs[outputID] = ni;
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
        this.registerNodeType(stuff, { category, title: template.name });

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
                    return;
                }
                const templateInput = templateInputArr[0];
                const targetInterface = this._graph.findNodeInterface(
                    templateInput.nodeInterfaceId,
                );
                if (!targetInterface) {
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
                    return;
                }
                const templateInout = templateInoutArr[0];
                const targetInterface = this._graph.findNodeInterface(
                    templateInout.nodeInterfaceId,
                );
                if (!targetInterface) {
                    return;
                }
                this._graph.addConnection(targetInterface, node.inputs.placeholder);
            });

        Object.entries(subgraphNode.outputs)
            .filter((output) => output[1].name !== '_calculationResults')
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
                    return;
                }
                const templateOutput = templateOutputArr[0];
                const targetInterface = this._graph.findNodeInterface(
                    templateOutput.nodeInterfaceId,
                );
                if (!targetInterface) {
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
