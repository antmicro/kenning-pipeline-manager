// eslint-disable-next-line max-classes-per-file
import { NodeInterface } from '@baklavajs/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Checks whether the interface is a bus interface, i.e. it has a bus with a type.
 *
 * @param {Object} intf - The interface to check.
 * @returns {boolean} True if the interface is a bus interface.
 */
export function isBusInterface(intf) {
    return intf?.bus?.type !== undefined;
}

/**
 * Checks whether the interface is a one-sided bus, i.e. all of its stubs
 * share the side of the bus itself.
 *
 * @param {Object} intf - The interface to check.
 * @returns {boolean} True if the interface is a one-sided bus.
 */
export function isOneSidedBus(intf) {
    return intf?.bus?.type === 'oneSided';
}

/**
 * Checks whether the interface is a two-sided bus, i.e. each of its stubs
 * can be placed on either side of the node.
 *
 * @param {Object} intf - The interface to check.
 * @returns {boolean} True if the interface is a two-sided bus.
 */
export function isTwoSidedBus(intf) {
    return intf?.bus?.type === 'twoSided';
}

/**
 * Checks whether the interface is a displayed two-sided bus, i.e. a port
 * carrying a two-sided bus.
 *
 * @param {Object} intf - The interface to check.
 * @returns {boolean} True if the interface is a port of a two-sided bus.
 */
export function isBigBus(intf) {
    return intf.port && isTwoSidedBus(intf);
}

/**
 * Returns the list of bus stubs of the interface.
 *
 * @param {Object} intf - The interface to get the stubs of.
 * @returns {Array} The list of bus stubs, empty if the interface has none.
 */
export function getBusStubs(intf) {
    return intf?.bus?.stubs ?? [];
}

/**
 * Finds a bus stub of the interface by its id.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
export function findBusStub(intf, id) {
    return getBusStubs(intf).find((stub) => stub.id === id);
}

// eslint-disable-next-line max-classes-per-file
import { NodeInterface } from '@baklavajs/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Checks whether the bus interface has no stubs and therefore no connections.
 *
 * @param {Object} intf - The interface to check.
 * @returns {boolean} True if the interface is a bus without any stubs.
 */
export function isBusEmpty(intf) {
    return isBusInterface(intf) && getBusStubs(intf).length === 0;
}

/**
 * Checks whether the interface holds no connections and can therefore be hidden.
 *
 * A regular interface holds no connections when its connection count is zero.
 * An interface carrying a `bus` object holds no connections when the bus has
 * no stubs (whether the stubs list is missing or empty), since the stubs
 * (not the bus itself) are what hold the connections.
 *
 * @param {Object} intf - The interface to check.
 * @returns {boolean} True if the interface holds no connections.
 */
export function isInterfaceHidable(intf) {
    if (intf.bus === undefined) {
        return intf.connectionCount === 0;
    }
    return intf.bus.stubs === undefined || intf.bus.stubs.length === 0;
}

/**
 * The parent interfaces of a connection's endpoints together with the bus
 * stub parameters of the connection.
 *
 * @typedef {Object} ConnectionEndpointResolution
 * @property {any} from - The interface (or parent bus) of the connection's `from` endpoint.
 * @property {any} to - The interface (or parent bus) of the connection's `to` endpoint.
 * @property {number|undefined} offset - Position offset of the stub along the bus.
 * @property {string|undefined} stubID - The id of the stub.
 * @property {string|undefined} stubSide - The side of the stub.
 */

/**
 * Resolves the parameters needed to (re)create a connection through
 * `addConnection`.
 *
 * Bus connections are held by stubs, but `addConnection` expects the parent
 * bus interfaces (it recreates the stubs through `preConnectionCheck`). This
 * helper maps the connection endpoints to their parent buses (when they are
 * stubs) and extracts the stub's offset, id and side, so the stub can be
 * recreated at the same position.
 *
 * @param {Object} connection - The connection with `from` and `to` endpoints.
 * @returns {ConnectionEndpointResolution} The parent interfaces of the
 * connection endpoints together with the bus stub parameters of the connection.
 */
export function resolveConnectionEndpoints(connection) {
    const from = connection.from.parent ?? connection.from;
    const to = connection.to.parent ?? connection.to;
    let stub;
    if (connection.to.parent) {
        stub = connection.to;
    } else if (connection.from.parent) {
        stub = connection.from;
    }
    return {
        from,
        to,
        offset: stub?.offset,
        stubID: stub?.id,
        stubSide: stub?.side,
    };
}

/**
 * @typedef {Object} BusStub
 * @property {string} nodeId
 * @property {string} id
 * @property {string} direction
 * @property {boolean} isInput
 * @property {string} side
 * @property {number} maxConnectionsCount
 * @property {number} connectionCount
 * @property {string} type
 * @property {number} sidePosition
 * @property {number} offset
 * @property {Object} parent
 */

/**
 * Creates a stub object derived from an interface definition.
 *
 * @param {Object} intf - The source interface to base the stub on.
 * @param {number|undefined} [offset] - Position offset for the stub along the bus.
 * @param {string|undefined} [stubID] - Optional explicit ID for the stub.
 * @param {string|undefined} [stubSide] - Optional side override for the stub.
 * @returns {BusStub} A stub object that mimics normal interface.
 */
export function createStub(intf, offset = undefined, stubID = undefined, stubSide = undefined) {
    let ss = stubSide;
    if (!isTwoSidedBus(intf)) {
        ss = undefined;
    }
    const maxConnReached = (intf.maxConnectionsCount &&
        intf.maxConnectionsCount < intf.connectionCount + 1);
    const stub = {};
    stub.nodeId = intf.nodeId;
    stub.id = stubID ?? uuidv4();
    stub.direction = intf.direction;
    stub.isInput = intf.isInput;
    stub.side = ss ?? intf.side;
    stub.maxConnectionsCount = 1;
    stub.connectionCount = maxConnReached ? 1 : 0;
    stub.type = intf.type;
    stub.sidePosition = 0;
    stub.offset = offset ?? ((intf.bus?.size ?? 0) / 2);
    stub.parent = intf;
    // needed for when the connection creation succeeds
    stub.postConnectionCheck = intf.postConnectionCheck.bind(stub);
    return stub;
}

/**
 * Builds a property descriptor for the `side` property of an interface.
 *
 * @param {Object} intf - The interface the descriptor is created for.
 * @returns {Object} A property descriptor with `get`, `set`, `enumerable` and
 * `configurable` fields suitable for `Object.defineProperty`.
 */
function interfaceSideGetterSetter(intf) {
    // for twoSided, each stub can have its' own side
    if (isOneSidedBus(intf)) {
        return {
            get() {
                // eslint-disable-next-line no-underscore-dangle
                return this._side;
            },
            set(val) {
                // eslint-disable-next-line no-underscore-dangle
                this._side = val;
                this.bus?.stubs?.forEach((s) => {
                    // eslint-disable-next-line no-param-reassign
                    s.side = val;
                });
            },
            enumerable: true,
            configurable: true,
        };
    }
    if (intf.group) {
        return {
            get() {
                // eslint-disable-next-line no-underscore-dangle
                return this._side;
            },
            set(_) {
                // TODO implement since right now this is very much buggy
                // if the interfaces that should be part of a group get separated
                // weird things happen.
            },
            enumerable: true,
            configurable: true,
        };
    }
    return {
        get() {
            // eslint-disable-next-line no-underscore-dangle
            return this._side;
        },
        set(val) {
            // eslint-disable-next-line no-underscore-dangle
            this._side = val;
        },
        enumerable: true,
        configurable: true,
    };
}

/**
 * The members that {@link withCustomNodeFunctions} adds on top of the base
 * class: a reactive `side` property plus the bus/group connection-check and
 * lifecycle methods.
 *
 * @typedef {Object} CustomNodeFunctions
 * @property {string} side
 * @property {(*) => any} preConnectionCheck
 * @property {() => void} postConnectionCheck
 * @property {(stub: any, orphan?: boolean) => void} removeStub
 * @property {(connection: any) => boolean} isInConnection
 * @property {(node: any) => void} onCreate
 * @property {(node: any) => void} onDestroy
 */

/**
 * Returns a new class that extends `Base` and carries the custom node interface behavior: a
 * reactive `side` property plus the utility methods and lifecycle methods.
 *
 * This lets the custom behavior be layered onto any baklava interface (or onto
 * baklava's `NodeInterface` itself) without duplicating the base class logic.
 *
 * @template T
 * @param {new (...args: any[]) => T} Base - The base class to extend (e.g.
 * baklava's `NodeInterface` or a specific baklava interface).
 * @returns {new (...args: any[]) => (T & CustomNodeFunctions)} A class
 * extending `Base` whose instances also expose the {@link CustomNodeFunctions}
 * members.
 */
export function withCustomNodeFunctions(Base) {
    class Custom extends Base {
        /**
         * Creates a new interface instance.
         *
         * @param {...*} args - Arguments forwarded to the `Base` constructor.
         */
        constructor(...args) {
            super(...args);
            Object.defineProperty(this, 'side', interfaceSideGetterSetter(this));
        }

        /**
         * Runs the checks performed before a connection is created and returns the
         * interface (or stub) that should actually be used for the connection.
         *
         * @param {Object} other - The interface on the other end of the connection.
         * @param {Object} node - The node that owns the interfaces being connected.
         * @param {number|undefined} offset - Position offset used when creating a bus stub.
         * @param {string|undefined} stubID - Optional explicit ID for the created stub.
         * @param {string|undefined} stubSide - Optional side override for the created stub.
         * @returns {Object} The interface or stub to use for the connection.
         */
        preConnectionCheck(other, node, offset, stubID, stubSide) {
            if (this.group) {
                if (!this.groupSlaves) {
                    return this;
                }
                if (!this.isCollapsed) {
                    return this;
                }
                const allowedTypes = other.type;
                const intfs = { ...node.inputs, ...node.outputs };
                const allowed = Object.entries(intfs)
                    .find(([_, intf]) => {
                        if (!this.groupSlaves.includes(intf)) {
                            return false;
                        }
                        const typesOverlap =
                            intf.type.filter((type) => allowedTypes.includes(type));
                        const legalCount =
                        // eslint-disable-next-line no-underscore-dangle
                            (intf._connectionCount ?? 0) < (intf.maxConnectionCount ?? 1);
                        return typesOverlap.length && legalCount;
                    });
                return allowed?.[1] ?? this;
            }
            if (isBusInterface(this)) {
                if (this.bus.stubs === undefined) {
                    // eslint-disable-next-line no-param-reassign
                    this.bus.stubs = [];
                }
                const stub = createStub(this, offset, stubID, stubSide);

                return stub;
            }
            return this;
        }

        /**
         * Runs the checks performed after a connection is created.
         *
         * When this interface is a bus stub it increments the parent's connection
         * count and registers the stub in the parent's `bus.stubs` list.
         */
        postConnectionCheck() {
            if (this.parent) {
                // eslint-disable-next-line no-param-reassign
                this.parent.connectionCount += 1;
                this.parent.bus.stubs.push(this);
            }
        }

        /**
         * Removes a connection stub from this interface's bus.
         *
         * Called when a connection held by one of the bus stubs is removed. By
         * default the stub is dropped from the `bus.stubs` list; when `orphan`
         * is true the stub is kept and only marked as orphaned.
         *
         * @param {Object} stub - The stub to remove from the bus.
         * @param {boolean} [orphan] - When true the stub is kept and marked as orphaned.
         */
        removeStub(stub, orphan = false) {
            if (orphan) {
                // eslint-disable-next-line no-param-reassign
                stub.isOrphaned = true;
                return;
            }
            const stubs = this.bus?.stubs;
            if (!stubs) {
                return;
            }
            const index = stubs.indexOf(stub);
            if (index !== -1) {
                stubs.splice(index, 1);
            }
        }

        /**
         * Checks whether this interface participates in the given connection.
         *
         * For buses the check is performed against all of the bus's stubs, since a
         * stub (not the bus itself) is what actually holds the connection.
         *
         * @param {Object} connection - The connection to check, with `from` and `to` endpoints.
         * @returns {boolean} True if the interface (or one of its bus stubs) is an
         * endpoint of the connection.
         */
        isInConnection(connection) {
            if (isBusInterface(this)) {
                return this.bus?.stubs?.some((stub) =>
                    [connection.to, connection.from].includes(stub));
            }
            return [connection.to, connection.from].includes(this);
        }

        /**
         * Hook invoked when the interface is created.
         *
         * @param {Object} node - Node to which the interface belongs
         */
        // eslint-disable-next-line class-methods-use-this, no-unused-vars
        onCreate(node) { }

        /**
         * Hook invoked when the owning node is destroyed.
         *
         * If this interface belongs to an interface group, the group's master and
         * slaves are recomputed so the remaining interfaces stay correctly linked
         * after this one is removed.
         *
         * @param {Object} node - The node that is being destroyed.
         */
        onDestroy(node) {
            if (this.group) {
                const curGroup = this.group;
                let ports = Object.values({ ...node.inputs, ...node.outputs });
                ports = ports.filter((i) => i.port).filter((i) => i.group === curGroup);
                ports.forEach((p) => {
                    // eslint-disable-next-line no-param-reassign
                    delete p?.groupMaster;
                    // eslint-disable-next-line no-param-reassign
                    delete p?.groupSlaves;
                });
                ports = ports.filter((i) => i.name !== this.name);
                const newMaster = ports[0];
                const newSlaves = ports.slice(1);
                newMaster.groupSlaves = newSlaves;
                newSlaves.forEach((s) => {
                    // eslint-disable-next-line no-param-reassign
                    s.groupMaster = newMaster;
                });
            }
        }
    }
    return Custom;
}

/**
 * A custom node interface that extends baklava's `NodeInterface`.
 *
 * It adds a reactive `side` property and custom connection handling for
 * interface buses (which are split into stubs) and interface groups (which
 * share a single master with several slaves).
 *
 * Declared as a class (rather than a bare `const`) so that it exposes both a
 * value (the constructor, for `new` / `extends`) and a type (the instance
 * type, for TypeScript annotations). It adds no behavior of its own; it simply
 * is {@link withCustomNodeFunctions} applied to baklava's `NodeInterface`, so
 * every instance still carries the reactive `side` property and the
 * connection-check / lifecycle methods.
 */
export class CustomNodeInterface extends withCustomNodeFunctions(NodeInterface) { }
