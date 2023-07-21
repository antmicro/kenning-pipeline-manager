/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Implements custom version of baklava's Graph object
 */

import { GraphTemplate, DummyConnection, Connection } from '@baklavajs/core';
import { v4 as uuidv4 } from 'uuid';
import {
    SUBGRAPH_INPUT_NODE_TYPE,
    SUBGRAPH_INOUT_NODE_TYPE,
    SUBGRAPH_OUTPUT_NODE_TYPE,
} from './subgraphInterface.js';

/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
export default function createPipelineManagerGraph(graph) {
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
                error: `Too many connections from an input interface (${from.id}), maximum of ${from.maxConnectionsCount} are allowed.`,
            };
        }

        if (
            (to.maxConnectionsCount === 0 || to.maxConnectionsCount === undefined) &&
            to.connectionCount > 0
        ) {
            return {
                connectionAllowed: false,
                error: `By default only one connection to an input interface (${to.id}) allowed.`,
            };
        }

        if (to.maxConnectionsCount > 0 && to.connectionCount + 1 > to.maxConnectionsCount) {
            return {
                connectionAllowed: false,
                error: `Too many connections to an output interface (${to.id}), maximum of ${to.maxConnectionsCount} are allowed.`,
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
                    error: `No common types between interfaces. Interface ${from.id} supports types ${fromTypes} and interface ${to.id} supports types ${toTypes}.`,
                };
            }
        }

        if (this.events.checkConnection.emit({ from, to }).prevented) {
            return {
                connectionAllowed: false,
                error: `Connection between an input interface (${from.id}) and an output interface (${to.id}) was prevented`,
            };
        }

        const hookResults = this.hooks.checkConnection.execute({ from, to });
        if (hookResults.some((hr) => !hr.connectionAllowed)) {
            return {
                connectionAllowed: false,
                errors: `Connection between an input interface (${from.id}) and an output interface (${to.id}) was prevented`,
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

    graph.updateTemplate = function updateTemplate() {
        const inputs = [];
        const inputNodes = this.nodes.filter((n) => n.type === SUBGRAPH_INPUT_NODE_TYPE);
        inputNodes.forEach((n) => {
            const connections = this.connections.filter((c) => c.from === n.outputs.placeholder);
            connections.forEach((c) => {
                inputs.push({
                    id: n.graphInterfaceId,
                    name: n.inputs.name.value,
                    nodeInterfaceId: c.to.id,
                    side: n.inputs.side.value.toLowerCase(),
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
                    side: n.inputs.side.value.toLowerCase(),
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
                    side: n.inputs.side.value.toLowerCase(),
                    direction: 'inout',
                    nodePosition: n.position,
                });
            });
            const connectionsFrom = this.connections.filter((c) => c.from === n.inputs.placeholder);
            connectionsFrom.forEach((c) => {
                inputs.push({
                    id: n.graphInterfaceId,
                    name: n.inputs.name.value,
                    nodeInterfaceId: c.to.id,
                    side: n.inputs.side.value.toLowerCase(),
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
        this.inputs = state.inputs;
        this.outputs = state.outputs;

        state.nodes.forEach((n) => {
            const nodeInformation = this.editor.nodeTypes.get(n.type);
            if (!nodeInformation) {
                errors.push(`Node type ${n.type} is not registered`);
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
                    `Connection of id: ${c.id} invalid. Could not find interface with id ${c.from}`,
                );
            } else if (!fromIf.port) {
                errors.push(
                    `Connection of id: ${c.id} invalid. Source of the connection is not an Interface`,
                );
            } else if (!toIf) {
                errors.push(
                    `Connection of id: ${c.id} invalid. Could not find interface with id ${c.to}`,
                );
            } else if (!toIf.port) {
                errors.push(
                    `Connection of id: ${c.id} invalid. Destination of the connection is not an Interface`,
                );
            } else if (
                state.connections.some(
                    (conn) => conn.id === c.id && (conn.from !== c.from || conn.to !== c.to),
                )
            ) {
                errors.push(`Connection of id: ${c.id} invalid. ID is already taken.`);
            } else {
                // Manually adding connections instead of using `addConnection` from baklavajs
                // as we want to get a feedback message from `checkConnection` function
                // which is suppressed in baklavajs functionality
                const checkConnectionResult = this.checkConnection(fromIf, toIf);
                if (!checkConnectionResult.connectionAllowed) {
                    errors.push(
                        `Could not create connection of id: ${c.id}. ${checkConnectionResult.error}`,
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
                    this.internalAddConnection(conn);
                }
            }
        });

        this.hooks.load.execute(state);
        return errors;
    };

    return graph;
}
