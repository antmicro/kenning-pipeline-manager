/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Implements custom version of baklava's Graph object
 */

import {
    GraphTemplate, DummyConnection, Connection,
} from '@baklavajs/core';
import { v4 as uuidv4 } from 'uuid';
import { BaklavaEvent } from '@baklavajs/events';
import { startTransaction, commitTransaction } from '../core/History.ts';
import { updateInterfacePosition } from './CustomNode.js';

/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
export default function createPipelineManagerGraph(graph) {
    // Add an event for adding an anchor to the graph
    graph.events.addAnchor = new BaklavaEvent();
    graph.events.removeAnchor = new BaklavaEvent();

    // Add an event for editing node
    graph.events.editNode = new BaklavaEvent();

    // Graph node that represents the graph itself. Root graph does not have a node graph assigned.
    graph.graphNode = undefined;

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

    /**
     * Adds an anchor to the connection and creates an event that
     * the anchor was added, which is used by history system.
     *
     * @param anchor anchor to be added
     * @param connection connection to which the anchor is added
     * @param position position of the anchor in the connection
     */
    graph.addAnchor = function addAnchor(anchor, connection, position) {
        const anchorToAdd = {
            x: anchor.x,
            y: anchor.y,
            id: uuidv4(),
        };
        if (connection.anchors === undefined) connection.anchors = [];

        connection.anchors.splice(position, 0, anchorToAdd);
        graph.events.addAnchor.emit([connection, (position * 3 + 1)]);
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
                        false,
                        false,
                    );
                }
                if (Object.prototype.hasOwnProperty.call(newNodeInstance.outputs, name)) {
                    updateInterfacePosition(
                        newNodeInstance,
                        newNodeInstance.outputs[name],
                        intf.side,
                        intf.sidePosition,
                        false,
                        false,
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

    graph.addNode = function addNode(node, graphLoadingState, nodeId) {
        if (this.events.beforeAddNode.emit(node).prevented) {
            return;
        }
        this.nodeEvents.addTarget(node.events);
        this.nodeHooks.addTarget(node.hooks);
        node.registerGraph(this);

        if (node.template !== undefined) {
            const newState = JSON.parse(JSON.stringify(node.template.save()));
            newState.id ??= uuidv4();
            node.template = new GraphTemplate(newState, this.editor);
        }

        this._nodes.push(node);
        // when adding the node to the array, it will be made reactive by Vue.
        // However, our current reference is the non-reactive version.
        // Therefore, we need to get the reactive version from the array.
        node = this.nodes.find((n) => n.id === node.id);
        node.onPlaced(graphLoadingState, nodeId);
        this.events.addNode.emit(node);
        return node; // eslint-disable-line consistent-return
    };

    graph.destroy = function destroy() {
        // Remove possibility of removing graphs - this ignores changes made by
        // default switchGraph (unregistering from editor and removing nodes) and
        // allows to later reuse this instance

        // TODO: This causes memory leaks, as when reloading a graph, all non-destroyed
        // graphs linger are are completely unnaccessible
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
        this.id = state.id ?? uuidv4();
        this.name = state.name ?? undefined;

        state.nodes.forEach((n) => {
            const nodeInformation = this.editor.nodeTypes.get(n.name);

            if (!nodeInformation) {
                errors.push(`Node type ${n.name} is not registered`);
            } else {
                const node = new nodeInformation.type(); // eslint-disable-line new-cap

                // The node state may not have an id, so we it has to be assigned manually
                // if needed
                n.id ??= uuidv4();

                this.addNode(node, state.graphLoadingState, n.id);
                const nodeErrors = node.load(n);
                if (Array.isArray(nodeErrors) && nodeErrors.length) {
                    errors.push(...nodeErrors);
                }
            }
        });

        // Assigning ids to connections that do not have them
        state.connections.forEach((c) => {
            c.id ??= uuidv4();
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

                    c.anchors?.forEach((anchor, index) => {
                        graph.addAnchor(anchor, conn, index);
                    });
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

    graph.removeNode = function removeNode(node) {
        if (this.nodes.includes(node)) {
            if (this.events.beforeRemoveNode.emit(node).prevented) {
                return;
            }
            const interfaces = [...Object.values(node.inputs), ...Object.values(node.outputs)];
            this.connections
                .filter((c) => interfaces.includes(c.from) || interfaces.includes(c.to))
                .forEach((c) => this.removeConnection(c));
            this._nodes.splice(this.nodes.indexOf(node), 1);
            this.events.removeNode.emit(node);
            node.onDestroy();
            this.nodeEvents.removeTarget(node.events);
            this.nodeHooks.removeTarget(node.hooks);
        }
    };

    graph.removeNodeOnly = function removeNodeOnly(node) {
        this._nodes.splice(this.nodes.indexOf(node), 1);
        this.events.removeNode.emit(node);
        node.onDestroy();
        this.nodeEvents.removeTarget(node);
        this.nodeHooks.removeTarget(node);
    };

    graph.editNode = function editNode(node) {
        this.events.editNode.emit(node);
    };

    graph.obtainExposedNames = function obtainExposedNames() {
        const exposedNames = [];
        this._nodes.forEach((node) => {
            Object.values({ ...node.inputs, ...node.outputs }).forEach((intf) => {
                if (intf.externalName !== undefined) {
                    exposedNames.push(intf.externalName);
                }
            });
        });
        return exposedNames;
    };

    graph.isIncorrectExternalName = function isIncorrectExternalName(name, exposedNames) {
        if (this.graphNode === undefined) return false;

        const sameExposedNames = exposedNames.filter((n) => n === name).length;

        // Extract interface names from graph node
        const interfaces = [
            ...Object.keys(this.graphNode.inputs),
            ...Object.keys(this.graphNode.outputs),
        ].map((intf) => intf.split('_'))
            .filter((intf) => intf[0] !== 'property')
            .map((intf) => intf[1]);

        const sameInterfaceNames = interfaces.filter((n) => n === name).length;
        return name.length === 0 || sameExposedNames !== 0 || sameInterfaceNames !== 0;
    };

    graph.resolveNewExposedName = function resolveNewExposedName(name) {
        const exposedNames = this.obtainExposedNames();

        // Check if the external name is taken and add a suffix if it is
        let suffix = 1;
        let tmpName = name;
        while (this.isIncorrectExternalName(tmpName, exposedNames)) {
            tmpName = `${name}_${suffix}`;
            suffix += 1;
        }
        return tmpName;
    };

    return graph;
}
