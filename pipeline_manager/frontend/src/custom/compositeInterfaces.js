/*
 * Copyright (c) 2026 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Unrolling and collapsing of composite interfaces.
 */

import { toRaw } from 'vue';
import { CustomNodeInterface } from './CustomNodeInterface.js';

/**
 * Normalizes a sub-interface type to the array form used by the ports.
 *
 * @param {string|Array|undefined} type - Type of the sub-interface.
 * @returns {Array|undefined} The type as an array.
 */
function normalizeType(type) {
    if (type === undefined) return undefined;
    return Array.isArray(type) ? [...type] : [type];
}

/**
 * Creates the port of a single sub-interface of a composite interface.
 *
 * @param {Object} intf - The composite interface owning the sub-port.
 * @param {Object} sub - Sub-interface definition.
 * @returns {CustomNodeInterface} The created sub-port.
 */
function createSubPort(intf, sub) {
    const direction = sub.direction ?? intf.direction ?? 'inout';
    const port = new CustomNodeInterface(sub.name);
    Object.assign(port, {
        id: sub.id,
        name: sub.name,
        type: normalizeType(sub.type),
        direction,
        isInput: direction !== 'output',
        port: true,
        hidden: false,
        side: intf.side,
        connections: [],
        connectionCount: 0,
        // runtime-only port created by unrolling a composite interface
        isCompositeSub: true,
        compositeParent: intf.id,
    });
    port.nodeId = intf.nodeId;
    return port;
}

/**
 * Returns the ports unrolled from the sub-interfaces of a composite interface. The instances are
 * cached on the interface, so that connections can hold stable references across collapsing and
 * expanding.
 *
 * @param {Object} intf - composite interface.
 * @returns {Array<CustomNodeInterface>} sub-ports.
 */
export function getCompositePorts(intf) {
    if (intf.compositePorts !== undefined) {
        return intf.compositePorts;
    }
    const ports = (intf.getCompositeSubInterfaces?.() ?? []).map(
        (sub) => createSubPort(intf, sub),
    );
    // eslint-disable-next-line no-param-reassign
    intf.compositePorts = ports;
    return ports;
}

/**
 * Tells which endpoint of a connection is held by the given interface.
 *
 * @param {Object} connection - connection to inspect.
 * @param {Object} intf - interface to look for.
 * @returns {string|undefined} `'from'`, `'to'`, or undefined if the interface
 * is not an endpoint of the connection.
 */
function endpointSide(connection, intf) {
    if (connection.from === intf || connection.from?.id === intf.id) return 'from';
    if (connection.to === intf || connection.to?.id === intf.id) return 'to';
    return undefined;
}

/**
 * Moves one endpoint of a connection to a different interface, updating the
 * connection counts and connection lists of both interfaces.
 *
 * @param {Object} connection - connection whose endpoint is moved.
 * @param {string} side - `'from'` or `'to'`.
 * @param {Object} endpoint - interface to attach that side to.
 */
function rehomeEndpoint(connection, side, endpoint) {
    const previous = connection[side];
    const target = toRaw(endpoint);
    // eslint-disable-next-line no-param-reassign
    connection[side] = target;

    if (previous !== undefined) {
        previous.connectionCount = Math.max((previous.connectionCount ?? 1) - 1, 0);
        if (Array.isArray(previous.connections)) {
            previous.connections = previous.connections.filter(
                (c) => c.id !== connection.id,
            );
        }
    }
    target.connectionCount = (target.connectionCount ?? 0) + 1;
    if (!Array.isArray(target.connections)) {
        target.connections = [];
    }
    target.connections.push(connection);
}

/**
 * Expands a composite interface.
 *
 * @param {Object} intf - composite interface to unroll.
 * @param {Object} graph - graph the node belongs to.
 */
function expandCompositeInterfaces(intf, graph) {
    getCompositePorts(intf);

    const remembered = intf.compositeReturn ?? {};
    Object.entries(remembered).forEach(([connectionId, subId]) => {
        const connection = graph?.connections.find((c) => c.id === connectionId);
        const port = (intf.compositePorts ?? []).find((p) => p?.id === subId);
        const side = connection === undefined ? undefined : endpointSide(connection, intf);
        if (connection === undefined || port === undefined || side === undefined) {
            delete remembered[connectionId];
            return;
        }
        rehomeEndpoint(connection, side, port);
        delete remembered[connectionId];
    });

    // eslint-disable-next-line no-param-reassign
    intf.compositeExpanded = true;
    graph?.refreshConnections?.();
}

/**
 * Collapses a composite interface.
 *
 * @param {Object} intf - composite interface to collapse.
 * @param {Object} graph - graph the node belongs to.
 */
function collapseCompositeInterfaces(intf, graph) {
    if (!intf.isCompositeInterface()) return;
    // eslint-disable-next-line no-param-reassign
    intf.compositeReturn = intf.compositeReturn ?? {};
    const remembered = intf.compositeReturn;

    (intf.compositePorts ?? []).forEach((port) => {
        if (!port.isCompositeInterface()) return;
        collapseCompositeInterfaces(port, graph);
    });

    const connections = graph?.connections ?? [];
    (intf.compositePorts ?? []).forEach((port) => {
        if (port === undefined) return;
        [...connections].forEach((connection) => {
            const side = endpointSide(connection, port);
            if (side === undefined) return;
            remembered[connection.id] = port.id;
            rehomeEndpoint(connection, side, intf);
        });
    });

    // eslint-disable-next-line no-param-reassign
    intf.compositeExpanded = false;
    graph?.refreshConnections?.();
}

/**
 * Toggles the expansion of a composite interface.
 *
 * @param {Object} intf - The composite interface to toggle.
 * @param {Object} graph - The graph the node belongs to.
 */
export function toggleCompositeInterfaces(intf, graph) {
    if (intf.compositeExpanded) {
        collapseCompositeInterfaces(intf, graph);
    } else {
        expandCompositeInterfaces(intf, graph);
    }
}
