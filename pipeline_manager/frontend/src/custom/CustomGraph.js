/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Implements custom version of baklava's Graph object
 */

import {
    GraphTemplate, DummyConnection, Connection, GRAPH_NODE_TYPE_PREFIX,
} from '@baklavajs/core';
import { v4 as uuidv4 } from 'uuid';
import { BaklavaEvent } from '@baklavajs/events';
import {
    SUBGRAPH_INPUT_NODE_TYPE,
    SUBGRAPH_INOUT_NODE_TYPE,
    SUBGRAPH_OUTPUT_NODE_TYPE,
    SubgraphInoutNode,
    SubgraphInputNode,
    SubgraphOutputNode,
} from './subgraphInterface.js';
import { startTransaction, commitTransaction } from '../core/History.ts';
import { updateInterfacePosition } from './CustomNode.js';

/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
export default function createPipelineManagerGraph(graph) {
    // Add an event for adding an anchor to the graph
    graph.events.addAnchor = new BaklavaEvent();
    graph.events.removeAnchor = new BaklavaEvent();

    graph.checkConnection = function checkConnection(from, to) {
        if (!from || !to) {
            return { connectionAllowed: false, error: 'Invalid from and to references.' };
        }

        const fromNode = this.findNodeById(from.nodeId);
        const toNode = this.findNodeById(to.nodeId);

        if (fromNode && toNode && fromNode === toNode && !this.editor.allowLoopbacks) {
            return { connectionAllowed: false, error: 'Loopbacks are not allowed.' };
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
            return {
                connectionAllowed: false,
                error: 'Connections are only allowed from output or inout interfaces.',
            };
        }

        if (!to.isInput) {
            return {
                connectionAllowed: false,
                error: 'Connections are only allowed to input or inout interfaces.',
            };
        }

        if (this.connections.some((c) => c.from === from && c.to === to)) {
            return { connectionAllowed: false, error: 'Duplicate connections are not allowed.' };
        }

        if (from.maxConnectionsCount > 0 && from.connectionCount + 1 > from.maxConnectionsCount) {
            return {
                connectionAllowed: false,
                error: `Too many connections from an input interface '${from.id}', maximum of '${from.maxConnectionsCount}' are allowed.`,
            };
        }

        if (
            (to.maxConnectionsCount === 0 || to.maxConnectionsCount === undefined) &&
            to.connectionCount > 0
        ) {
            return {
                connectionAllowed: false,
                error: `By default only one connection to an input interface '${to.id}' allowed.`,
            };
        }

        if (to.maxConnectionsCount > 0 && to.connectionCount + 1 > to.maxConnectionsCount) {
            return {
                connectionAllowed: false,
                error: `Too many connections to an output interface '${to.id}', maximum of '${to.maxConnectionsCount}' are allowed.`,
            };
        }

        if (from.type && to.type) {
            const fromTypes =
                typeof from.type === 'string' || from.type instanceof String
                    ? [from.type]
                    : from.type;
            const toTypes =
                typeof to.type === 'string' || to.type instanceof String ? [to.type] : to.type;

            const commonType = fromTypes.find((t) => toTypes.includes(t));

            if (commonType === undefined) {
                return {
                    connectionAllowed: false,
                    error: `No common types between interfaces. Interface '${from.id}' supports types '${fromTypes}' and interface '${to.id}' supports types '${toTypes}'.`,
                };
            }
        }

        if (this.events.checkConnection.emit({ from, to }).prevented) {
            return {
                connectionAllowed: false,
                error: `Connection between an input interface '${from.id}' and an output interface '${to.id}' was prevented`,
            };
        }

        const hookResults = this.hooks.checkConnection.execute({ from, to });
        if (hookResults.some((hr) => !hr.connectionAllowed)) {
            return {
                connectionAllowed: false,
                errors: `Connection between an input interface '${from.id}' and an output interface '${to.id}' was prevented`,
            };
        }

        // List of connections that are removed once the dummyConnection is created
        const connectionsInDanger = [];
        return {
            connectionAllowed: true,
            dummyConnection: new DummyConnection(from, to),
            connectionsInDanger,
        };
    };

    // Replaces given instance of a node with a node of type `newNodeName`
    // All properties that are common preserve their values
    // All connections that were connected to the interfaces that are common
    // for those two nodes are preserved as well.
    graph.replaceNode = function replaceNode(oldNode, newNodeName) {
        const oldPosition = oldNode.position;
        const newNode = this.editor.nodeTypes.get(newNodeName);
        const newNodeInstance = new newNode.type(); // eslint-disable-line new-cap

        // Restoring a custom title of the node
        if (oldNode.title !== oldNode.type) {
            newNodeInstance.title = oldNode.title;
        }

        // Restoring properties and interfaces
        Object.entries({ ...oldNode.inputs, ...oldNode.outputs }).forEach(([name, intf]) => {
            if (intf.direction !== undefined) {
                if (Object.prototype.hasOwnProperty.call(newNodeInstance.inputs, name)) {
                    updateInterfacePosition(
                        newNodeInstance,
                        newNodeInstance.inputs[name],
                        intf.side,
                        intf.sidePosition,
                    );
                }
                if (Object.prototype.hasOwnProperty.call(newNodeInstance.outputs, name)) {
                    updateInterfacePosition(
                        newNodeInstance,
                        newNodeInstance.outputs[name],
                        intf.side,
                        intf.sidePosition,
                    );
                }
                // If the new node has the same property of the same type as it could be overridden
            } else if (
                Object.prototype.hasOwnProperty.call(newNodeInstance.inputs, name) &&
                newNodeInstance.inputs[name].componentName === intf.componentName
            ) {
                newNodeInstance.inputs[name].value = intf.value;
            }
        });

        // Restoring connections
        const interfaces = [...Object.values(oldNode.inputs), ...Object.values(oldNode.outputs)];
        const connections = this.connections.filter(
            (c) => interfaces.includes(c.from) || interfaces.includes(c.to),
        );

        const connectionsToRestore = [];

        Object.entries({ ...oldNode.inputs, ...oldNode.outputs }).forEach(([name, intf]) => {
            if (intf.direction === undefined) return;

            // Rewiring connections to new interfaces
            connections.forEach((conn) => {
                if (Object.prototype.hasOwnProperty.call(newNodeInstance.inputs, name)) {
                    if (conn.from === intf) {
                        const newConn = new Connection(newNodeInstance.inputs[name], conn.to);
                        newConn.anchors = conn.anchors;
                        connectionsToRestore.push(newConn);
                    } else if (conn.to === intf) {
                        const newConn = new Connection(conn.from, newNodeInstance.inputs[name]);
                        newConn.anchors = conn.anchors;
                        connectionsToRestore.push(newConn);
                    }
                }

                if (Object.prototype.hasOwnProperty.call(newNodeInstance.outputs, name)) {
                    if (conn.from === intf) {
                        const newConn = new Connection(newNodeInstance.outputs[name], conn.to);
                        newConn.anchors = conn.anchors;
                        connectionsToRestore.push(newConn);
                    } else if (conn.to === intf) {
                        const newConn = new Connection(conn.from, newNodeInstance.outputs[name]);
                        newConn.anchors = conn.anchors;
                        connectionsToRestore.push(newConn);
                    }
                }
            });
        });

        newNodeInstance.position = oldPosition;

        startTransaction();

        this.removeNode(oldNode);
        this.addNode(newNodeInstance);
        connectionsToRestore.forEach((conn) => this.internalAddConnection(conn));

        commitTransaction();

        return newNodeInstance;
    };

    graph.updateInterfaces = function updateInterfaces() {
        const { inputs } = this;
        const inputNodes = this.nodes.filter((n) => n.type === SUBGRAPH_INPUT_NODE_TYPE);

        // If a side is switched then it is possible that there already exists
        // an interface with the same sidePosition.
        // This function is used to set a new sidePosition for such interface.
        const needsNewSidePosition = (io, newSide) => {
            if (io.side !== newSide) {
                return [...this.inputs, ...this.outputs]
                    .filter((intf) => intf.side === newSide)
                    .find((intf) => intf.sidePosition === io.sidePosition) !== undefined;
            }
            return false;
        };

        const getMaxSidePosition = (newSide) => [...this.inputs, ...this.outputs]
            .filter((intf) => intf.side === newSide)
            .map((intf) => intf.sidePosition ?? 0)
            .reduce((a, b) => Math.max(a, b), -Infinity);

        inputNodes.forEach((n) => {
            const idx = inputs.findIndex((x) => x.id === n.graphInterfaceId);

            if (idx === -1) {
                inputs.push({
                    id: n.graphInterfaceId,
                    subgraphNodeId: n.outputs.placeholder.id,
                    name: n.inputs.name.value,
                    side: n.inputs.side.value.toLowerCase(),
                    direction: 'input',
                    nodePosition: n.position,
                    sidePosition: undefined,
                });
            } else {
                // To avoid redundancy the information about direction is not saved to subgraphIO
                // in the dataflow, and therefore the information does not make it here.
                // These values can be hardcoded easily here and this line prevents data duplication
                // in the dataflow.
                if (needsNewSidePosition(inputs[idx], n.inputs.side.value.toLowerCase())) {
                    inputs[idx].sidePosition = getMaxSidePosition(
                        n.inputs.side.value.toLowerCase(),
                    ) + 1;
                }

                inputs[idx].direction = 'input';
                inputs[idx].name = n.inputs.name.value;
                inputs[idx].side = n.inputs.side.value.toLowerCase();
                inputs[idx].nodePosition = n.position;
            }
        });

        const { outputs } = this;
        const outputNodes = this.nodes.filter((n) => n.type === SUBGRAPH_OUTPUT_NODE_TYPE);
        outputNodes.forEach((n) => {
            const idx = outputs.findIndex((x) => x.id === n.graphInterfaceId);

            if (idx === -1) {
                outputs.push({
                    id: n.graphInterfaceId,
                    subgraphNodeId: n.inputs.placeholder.id,
                    name: n.inputs.name.value,
                    side: n.inputs.side.value.toLowerCase(),
                    direction: 'output',
                    nodePosition: n.position,
                    sidePosition: undefined,
                });
            } else {
                if (needsNewSidePosition(outputs[idx], n.inputs.side.value.toLowerCase())) {
                    const a = getMaxSidePosition(
                        n.inputs.side.value.toLowerCase(),
                    ) + 1;
                    outputs[idx].sidePosition = a;
                }

                outputs[idx].direction = 'output';
                outputs[idx].name = n.inputs.name.value;
                outputs[idx].side = n.inputs.side.value.toLowerCase();
                outputs[idx].nodePosition = n.position;
            }
        });

        const inoutNodes = this.nodes.filter((n) => n.type === SUBGRAPH_INOUT_NODE_TYPE);
        inoutNodes.forEach((n) => {
            const idx = inputs.findIndex((x) => x.id === n.graphInterfaceId);

            if (idx === -1) {
                inputs.push({
                    id: n.graphInterfaceId,
                    subgraphNodeId: n.inputs.placeholder.id,
                    name: n.inputs.name.value,
                    side: n.inputs.side.value.toLowerCase(),
                    direction: 'inout',
                    nodePosition: n.position,
                    sidePosition: undefined,
                });
            } else {
                if (needsNewSidePosition(inputs[idx], n.inputs.side.value.toLowerCase())) {
                    inputs[idx].sidePosition = getMaxSidePosition(
                        n.inputs.side.value.toLowerCase(),
                    ) + 1;
                }

                inputs[idx].direction = 'inout';
                inputs[idx].name = n.inputs.name.value;
                inputs[idx].side = n.inputs.side.value.toLowerCase();
                inputs[idx].nodePosition = n.position;
            }
        });

        // Filtering interfaces that were removed and do not have corresponding nodes
        this.inputs = inputs.filter(
            (inp) => undefined !== this.nodes.find((n) => n.graphInterfaceId === inp.id),
        );
        this.outputs = outputs.filter(
            (inp) => undefined !== this.nodes.find((n) => n.graphInterfaceId === inp.id),
        );
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

    graph.load = function load(state) {
        const errors = [];

        // Clear current state
        for (let i = this.connections.length - 1; i >= 0; i -= 1) {
            this.removeConnection(this.connections[i]);
        }
        for (let i = this.nodes.length - 1; i >= 0; i -= 1) {
            this.removeNode(this.nodes[i]);
        }

        // Load state
        this.id = state.id;
        this.name = state.name ?? undefined;
        this.inputs = state.inputs;
        this.outputs = state.outputs;

        // Adding subgraph interface nodes
        const convertToUpperCase = (str) => `${str[0].toUpperCase()}${str.slice(1)}`;
        this.inputs.filter((input) => input.direction === 'input')
            .forEach((input) => {
                const node = new SubgraphInputNode();
                node.inputs.name.value = input.name;
                node.inputs.side.value = convertToUpperCase(input.side);
                node.outputs.placeholder.id = input.subgraphNodeId;
                node.graphInterfaceId = input.id;
                node.position = input.nodePosition ?? { x: 0, y: 0 };
                this.addNode(node);
            });

        this.inputs.filter((inout) => inout.direction === 'inout')
            .forEach((inout) => {
                const node = new SubgraphInoutNode();
                node.inputs.name.value = inout.name;
                node.inputs.side.value = convertToUpperCase(inout.side);
                node.inputs.placeholder.id = inout.subgraphNodeId;
                node.graphInterfaceId = inout.id;
                node.position = inout.nodePosition ?? { x: 0, y: 0 };
                this.addNode(node);
            });

        this.outputs.forEach((output) => {
            const node = new SubgraphOutputNode();
            node.inputs.name.value = output.name;
            node.inputs.side.value = convertToUpperCase(output.side);
            node.inputs.placeholder.id = output.subgraphNodeId;
            node.graphInterfaceId = output.id;
            node.position = output.nodePosition ?? { x: 0, y: 0 };
            this.addNode(node);
        });

        state.nodes.forEach((n) => {
            if (n.subgraph !== undefined) {
                n.name = `${GRAPH_NODE_TYPE_PREFIX}${n.name}`;
            }

            const nodeInformation = this.editor.nodeTypes.get(n.name);
            if (!nodeInformation) {
                errors.push(`Node type ${n.name} is not registered`);
            } else {
                const node = new nodeInformation.type(); // eslint-disable-line new-cap
                node.id = n.id;
                this.addNode(node);
                const nodeErrors = node.load(n);
                if (Array.isArray(nodeErrors) && nodeErrors.length) {
                    errors.push(...nodeErrors);
                }
            }
        });

        state.connections.forEach((c) => {
            const fromIf = this.findNodeInterface(c.from);
            const toIf = this.findNodeInterface(c.to);
            if (!fromIf) {
                errors.push(
                    `Connection of id '${c.id}' invalid. Could not find interface with id '${c.from}'`,
                );
            } else if (!fromIf.port) {
                errors.push(
                    `Connection of id '${c.id}' invalid. Source of the connection is not an Interface`,
                );
            } else if (!toIf) {
                errors.push(
                    `Connection of id '${c.id}' invalid. Could not find interface with id '${c.to}'`,
                );
            } else if (!toIf.port) {
                errors.push(
                    `Connection of id '${c.id}' invalid. Destination of the connection is not an Interface`,
                );
            } else if (
                state.connections.some(
                    (conn) => conn.id === c.id && (conn.from !== c.from || conn.to !== c.to),
                )
            ) {
                errors.push(`Connection of id '${c.id}' invalid. ID is already taken.`);
            } else {
                // Manually adding connections instead of using `addConnection` from baklavajs
                // as we want to get a feedback message from `checkConnection` function
                // which is suppressed in baklavajs functionality
                const checkConnectionResult = this.checkConnection(fromIf, toIf);
                if (!checkConnectionResult.connectionAllowed) {
                    errors.push(
                        `Could not create connection of id '${c.id}'. ${checkConnectionResult.error}`,
                    );
                } else {
                    checkConnectionResult.connectionsInDanger.forEach((connectionToRemove) => {
                        const instance = this.connections.find(
                            (conn) => conn.id === connectionToRemove.id,
                        );
                        if (instance) {
                            this.removeConnection(instance);
                        }
                    });

                    const conn = new Connection(
                        checkConnectionResult.dummyConnection.from,
                        checkConnectionResult.dummyConnection.to,
                    );

                    conn.anchors = c.anchors?.map((anchor) => ({ ...anchor, id: Date.now() }));
                    this.internalAddConnection(conn);
                }
            }
        });

        this.hooks.load.execute(state);
        return errors;
    };

    graph.size = function size() {
        const sizes = this.nodes.map((node) => {
            const HTMLelement = document.getElementById(node.id);
            return {
                width: HTMLelement.offsetWidth,
                height: HTMLelement.offsetHeight,
                position: node.position,
            };
        });
        const margin = 100;

        const rightmostX = Math.max(...sizes.map((node) => node.position.x + node.width)) + margin;
        const leftmostX = Math.min(...sizes.map((node) => node.position.x)) - margin;

        const bottommostY =
            Math.max(...sizes.map((node) => node.position.y + node.height)) + margin;
        const topmostY = Math.min(...sizes.map((node) => node.position.y)) - margin;

        const graphWidth = rightmostX - leftmostX;
        const graphHeight = bottommostY - topmostY;

        return {
            graphHeight,
            graphWidth,
            rightmostX,
            leftmostX,
            bottommostY,
            topmostY,
        };
    };

    graph.save = function save() {
        const state = {
            id: this.id,
            name: this.name,
            nodes: this.nodes.map((n) => n.save()),
            connections: this.connections.map((c) => ({
                id: c.id,
                from: c.from.id,
                to: c.to.id,
                anchors: c.anchors?.map((anchor) => ({
                    x: anchor.x,
                    y: anchor.y,
                })),
            })),
            inputs: this.inputs,
            outputs: this.outputs,
            scaling: this.scaling,
            panning: this.panning,
        };
        return this.hooks.save.execute(state);
    };

    graph.removeSelectedNodes = function removeSelectedNodes() {
        for (let i = this.selectedNodes.length - 1; i >= 0; i -= 1) {
            this.removeNode(this.selectedNodes[i]);
        }
    };

    graph.removeNodeOnly = function removeNodeOnly(node) {
        this._nodes.splice(this.nodes.indexOf(node), 1);
        this.events.removeNode.emit(node);
        node.onDestroy();
        this.nodeEvents.removeTarget(node);
        this.nodeHooks.removeTarget(node);
    };

    return graph;
}
