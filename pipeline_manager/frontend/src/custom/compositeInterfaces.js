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
import { resolveComposite, isSameCompositeType } from '../core/interfaceCompositeTypes.js';

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
    const saved = (toRaw(intf).compositeSaved ?? []).find(
        (entry) => entry?.name === sub.name,
    );
    const port = new CustomNodeInterface(sub.name);
    Object.assign(port, {
        id: saved?.id ?? sub.id,
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
        parentComposite: intf,
    });
    port.nodeId = intf.nodeId;
    port.compositeSaved = saved?.composite;
    const composite = resolveComposite(port);
    if (composite !== undefined) {
        port.composite = composite.interfaces;
    }
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
export function endpointSide(connection, intf) {
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

/**
 * Returns the pairs of leaf sub-ports that the two composite interfaces share by name, recursing
 * into nested composite sub-interfaces.
 *
 * @param {Object} fromIntf - One composite interface.
 * @param {Object} toIntf - The other composite interface.
 * @returns {Array<[Object, Object]>|undefined} The matched leaf-port pairs, or
 * undefined when the hierarchies of the two composites do not match.
 */
export function getCompositeLeafPairs(fromIntf, toIntf) {
    const fromPorts = getCompositePorts(fromIntf);
    const toPorts = getCompositePorts(toIntf);
    if (fromPorts.length === 0 || fromPorts.length !== toPorts.length) {
        return undefined;
    }
    const pairs = [];
    const mismatched = fromPorts.some((fromPort) => {
        if (fromPort === undefined) return true;
        const toPort = toPorts.find((port) => port?.name === fromPort.name);
        if (toPort === undefined) return true;
        const fromNested = fromPort.isCompositeInterface() === true;
        const toNested = toPort.isCompositeInterface() === true;
        if (fromNested !== toNested) return true;
        if (!fromNested) {
            pairs.push([fromPort, toPort]);
            return false;
        }
        const inner = getCompositeLeafPairs(fromPort, toPort);
        if (inner === undefined) return true;
        pairs.push(...inner);
        return false;
    });
    return mismatched ? undefined : pairs;
}

/**
 * Resolves which leaf port of `root`'s hierarchy one endpoint of a connection
 * belongs to.
 *
 * @param {Object} connection - The connection to inspect.
 * @param {string} side - `'from'` or `'to'`.
 * @param {Object} root - The composite interface whose hierarchy to resolve in.
 * @returns {Object|undefined} The leaf port of the hierarchy the endpoint
 * belongs to, or undefined when the connection does not touch `root`.
 */
function findPortById(ports, id) {
    return (ports ?? []).find((port) => port?.id === id);
}

/**
 * Resolves the leaf port a connection endpoint belongs to by following the
 * chain of `compositeReturn`.
 *
 * @param {Object} root - The group port holding the first provenance entry.
 * @param {string} connId - The id of the connection to resolve.
 * @returns {Object|undefined} The leaf port the endpoint was created on, or
 * undefined when it cannot be resolved.
 */
function provenanceLeaf(root, connId) {
    let port = findPortById(toRaw(root).compositePorts, toRaw(root).compositeReturn?.[connId]);
    while (port !== undefined && toRaw(port).isCompositeInterface() === true) {
        const nextPortId = toRaw(port).compositeReturn?.[connId];
        if (nextPortId === undefined) break;
        port = findPortById(toRaw(port).compositePorts, nextPortId);
    }
    return port;
}

function descendantLeafOf(connection, side, root) {
    const endpoint = connection[side];
    if (endpoint === undefined) return undefined;
    const rawRoot = toRaw(root);
    if (endpoint.id === rawRoot.id) {
        return provenanceLeaf(rawRoot, connection.id);
    }
    let current = toRaw(endpoint);
    while (current !== undefined) {
        if (current.id === rawRoot.id) return endpoint;
        current = current.parentComposite;
    }
    return undefined;
}

/**
 * Tells whether the given leaf-port pair of two composite interfaces is already held by a
 * connection, either directly on the leaf ports or on the ancestor ports they collapse into.
 *
 * @param {Object} graph - The graph the composite interfaces belong to.
 * @param {Object} fromIntf - One composite interface.
 * @param {Object} toIntf - The other composite interface.
 * @param {Object} fromPort - A leaf port of the first composite.
 * @param {Object} toPort - The matching leaf port of the second composite.
 * @returns {boolean} True if a connection already covers the pair.
 */
function pairHasConnection(graph, fromIntf, toIntf, fromPort, toPort) {
    return (graph?.connections ?? []).some((connection) => {
        const matches = (fromSide, toSide) =>
            descendantLeafOf(connection, fromSide, fromIntf)?.id === toRaw(fromPort).id
            && descendantLeafOf(connection, toSide, toIntf)?.id === toRaw(toPort).id;
        return matches('from', 'to') || matches('to', 'from');
    });
}

/**
 * Checks a connection between two composite interfaces.
 *
 * @param {Object} graph - The graph the composite interfaces belong to.
 * @param {Object} from - One composite interface (output side).
 * @param {Object} to - The other composite interface (input side).
 * @returns {Object} `{ connectionAllowed, error? , pairs? }`; `pairs` holds
 * the leaf-port pairs still to be connected.
 */
export function checkCompositeConnection(graph, from, to) {
    if (!isSameCompositeType(from, to)) {
        return {
            connectionAllowed: false,
            error: `Only composite interfaces of the same exact type can be connected.`,
        };
    }
    const pairs = getCompositeLeafPairs(from, to);
    if (pairs === undefined || pairs.length === 0) {
        return {
            connectionAllowed: false,
            error: `Composite interfaces do not contain matching sub-interfaces.`,
        };
    }
    const pending = [];
    let failedError;
    pairs.forEach(([fromPort, toPort]) => {
        if (failedError !== undefined) return;
        if (pairHasConnection(graph, from, to, fromPort, toPort)) return;
        const pairCheck = graph.checkConnection(toRaw(fromPort), toRaw(toPort));
        if (!pairCheck.connectionAllowed) {
            failedError = pairCheck.error ?? pairCheck.errors;
        } else {
            pending.push([fromPort, toPort]);
        }
    });
    if (failedError !== undefined) {
        return { connectionAllowed: false, error: failedError };
    }
    if (pending.length === 0) {
        return {
            connectionAllowed: false,
            error: 'Every sub-interface of the composite interfaces is already connected.',
        };
    }
    return { connectionAllowed: true, pairs: pending };
}

/**
 * Moves one connection endpoint from a leaf port up to the innermost expanded
 * ancestor port.
 *
 * @param {Object} connection - The connection whose endpoint is settled.
 * @param {string} side - `'from'` or `'to'`.
 * @param {Object} port - The leaf port the endpoint was created on.
 */
export function settleEndpoint(connection, side, port) {
    let current = toRaw(port);
    let parent = current.parentComposite;
    while (parent !== undefined && toRaw(parent).compositeExpanded !== true) {
        const rawParent = toRaw(parent);
        rawParent.compositeReturn = rawParent.compositeReturn ?? {};
        rawParent.compositeReturn[connection.id] = current.id;
        rehomeEndpoint(connection, side, rawParent);
        current = rawParent;
        parent = current.parentComposite;
    }
}

/**
 * Connects two composite interfaces by creating one connection per pair of matching sub-interfaces.
 *
 * @param {Object} graph - The graph the composite interfaces belong to.
 * @param {Object} from - One composite interface (output side).
 * @param {Object} to - The other composite interface (input side).
 * @returns {Object|undefined} One of the created connections (the others are
 * listed in the graph), or undefined when the connection was rejected.
 */
export function addCompositeConnection(graph, from, to) {
    const rawFrom = toRaw(from);
    const rawTo = toRaw(to);
    const check = checkCompositeConnection(graph, rawFrom, rawTo);
    if (!check.connectionAllowed) return undefined;

    const created = [];
    let failed = false;
    check.pairs.forEach(([fromPort, toPort]) => {
        if (failed) return;
        const connection = graph.addConnection(toRaw(fromPort), toRaw(toPort));
        if (connection === undefined) {
            failed = true;
            return;
        }
        created.push(connection);
        const fromSide = endpointSide(connection, fromPort);
        const toSide = endpointSide(connection, toPort);
        if (fromSide !== undefined) settleEndpoint(connection, fromSide, fromPort);
        if (toSide !== undefined) settleEndpoint(connection, toSide, toPort);
    });
    if (failed) {
        created.forEach((c) => graph.removeConnection(c));
        return undefined;
    }
    graph.refreshConnections?.();
    return created[created.length - 1];
}

/**
 * Resolves the endpoint ids a connection should be saved with.
 *
 * @param {Object} connection - The connection to serialize.
 * @returns {Object} `{ from, to }` with the ids of the leaf ports (or of the
 * plain endpoints when they do not belong to a composite interface).
 */
export function connectionSaveState(connection) {
    const savedId = (endpoint) => {
        const raw = toRaw(endpoint);
        if (raw === undefined) return undefined;
        if (raw.compositeReturn?.[connection.id] !== undefined) {
            const leaf = provenanceLeaf(raw, connection.id);
            if (leaf !== undefined) return toRaw(leaf).id;
        }
        return raw.id;
    };
    return { from: savedId(connection.from), to: savedId(connection.to) };
}

/**
 * Tells whether any port of the hierarchy of `port` is one of the saved connection endpoints.
 *
 * @param {Object} port - The port (or group port) to inspect.
 * @param {Set<string>} connectedIds - Ids of the leaf ports held by connections.
 * @returns {boolean} True if the port itself or any of its descendants is connected.
 */
function subtreeConnected(port, connectedIds) {
    const raw = toRaw(port);
    if (connectedIds.has(raw.id)) return true;
    if (!raw.isCompositeInterface()) return false;
    return (getCompositePorts(raw) ?? []).some(
        (sub) => sub !== undefined && subtreeConnected(sub, connectedIds),
    );
}

/**
 * Builds the `composite` tree of a composite interface for saving.
 *
 * @param {Object} intf - The composite interface.
 * @param {Set<string>} connectedIds - Ids of the leaf ports held by connections.
 * @returns {Array|undefined} The tree `[{ id, name, composite? }]`, or
 * undefined when nothing in the hierarchy is connected.
 */
export function compositeTreeToSave(intf, connectedIds) {
    const build = (port) => {
        if (!subtreeConnected(port, connectedIds)) return undefined;
        const raw = toRaw(port);
        const entry = { id: raw.id, name: raw.name };
        if (raw.isCompositeInterface()) {
            const subs = getCompositePorts(raw).map(build).filter((e) => e !== undefined);
            if (subs.length > 0) entry.composite = subs;
        }
        return entry;
    };
    const entries = (getCompositePorts(toRaw(intf)) ?? [])
        .filter((port) => port !== undefined)
        .map(build)
        .filter((entry) => entry !== undefined);
    return entries.length > 0 ? entries : undefined;
}

/**
 * Builds the ports of a composite interface and, recursively, all its nested composite sub-ports.
 *
 * @param {Object} intf - The composite interface.
 */
export function buildCompositePortsDeep(intf) {
    getCompositePorts(intf).forEach((port) => {
        if (port !== undefined && toRaw(port).isCompositeInterface()) {
            buildCompositePortsDeep(port);
        }
    });
}

/**
 * Finds a port unrolled from a composite interface by its id.
 *
 * @param {Object} intf - The composite interface whose hierarchy to search.
 * @param {string} id - The id of the port to find.
 * @returns {Object|undefined} The port with the given id, if found.
 */
export function findPortInHierarchy(intf, id) {
    let result;
    (toRaw(intf).compositePorts ?? []).some((port) => {
        if (port === undefined) return false;
        if (toRaw(port).id === id) {
            result = port;
            return true;
        }
        const inner = findPortInHierarchy(port, id);
        if (inner !== undefined) {
            result = inner;
            return true;
        }
        return false;
    });
    return result;
}
