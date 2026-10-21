/*
 * Copyright (c) 2026 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line max-classes-per-file
import { NodeInterface } from '@baklavajs/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Resolves the parameters needed to (re)create a connection through
 * `addConnection`.
 *
 * @param {Object} connection - The connection with `from` and `to` endpoints.
 * @returns The parent interfaces of the
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
    if (!intf.isTwoSidedBus()) {
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
 * @typedef {Object} CustomNodeFunctions
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
            const isInterfaceState = (arg) => typeof arg === 'object'
                && arg !== null
                && !Array.isArray(arg)
                && Object.getPrototypeOf(arg) === Object.prototype;
            const state = isInterfaceState(args[args.length - 1])
                ? args[args.length - 1] : undefined;
            super(...(state === undefined ? args : args.slice(0, -1)));
            Object.defineProperty(this, 'side', this.interfaceSideGetterSetter());
            if (state !== undefined) {
                Object.assign(this, state);
            }
        }

        /**
         * Checks whether this interface is a bus interface.
         *
         * @returns {boolean} True if the interface is a bus interface.
         */
        isBusInterface() {
            return this.bus?.type !== undefined;
        }

        /**
         * Checks whether this interface is a one-sided bus.
         *
         * @returns {boolean} True if the interface is a one-sided bus.
         */
        isOneSidedBus() {
            return this.bus?.type === 'oneSided';
        }

        /**
         * Checks whether this interface is a two-sided bus.
         *
         * @returns {boolean} True if the interface is a two-sided bus.
         */
        isTwoSidedBus() {
            return this.bus?.type === 'twoSided';
        }

        /**
         * Checks whether this interface is a displayed two-sided bus.
         *
         * @returns {boolean} True if the interface is a port of a two-sided bus.
         */
        isBigBus() {
            return this.port && this.isTwoSidedBus();
        }

        /**
         * Returns the list of bus stubs of this interface.
         *
         * @returns {Array} The list of bus stubs, empty if the interface has none.
         */
        getBusStubs() {
            return this.bus?.stubs ?? [];
        }

        /**
         * Checks whether this bus interface has no stubs and therefore no connections.
         *
         * @returns {boolean} True if the interface is a bus without any stubs.
         */
        isBusEmpty() {
            return this.isBusInterface() && this.getBusStubs().length === 0;
        }

        /**
         * Checks whether this interface holds no connections and can therefore be hidden.
         *
         * @returns {boolean} True if the interface holds no connections.
         */
        isInterfaceHidable() {
            if (this.bus === undefined) {
                const subPortsConnected = (this.compositePorts ?? []).some(
                    (port) => (port?.connectionCount ?? 0) > 0,
                );
                return this.connectionCount === 0 && !subPortsConnected;
            }
            return this.bus.stubs === undefined || this.bus.stubs.length === 0;
        }

        /**
         * Checks whether this interface is a positioned (custom shape) interface.
         *
         * @returns {boolean} True if the interface has a custom position.
         */
        isPositioned() {
            return this.x !== undefined && this.y !== undefined;
        }

        /**
         * Checks whether this interface is an interface group.
         *
         * @returns {boolean} True if the interface is an interface group.
         */
        isInterfaceGroup() {
            return this.interfaces !== undefined;
        }

        /**
         * Checks whether this interface is a composite interface, i.e. one of its
         * types names a composite defined in the specification's
         * `interfaceComposites`, and it hence hierarchically contains
         * sub-interfaces.
         *
         * @returns {boolean} True if the interface is a composite interface.
         */
        isCompositeInterface() {
            return this.composite !== undefined;
        }

        /**
         * Returns the sub-interfaces of this composite interface.
         *
         * @returns {Array} The list of sub-interfaces, empty if this interface is
         * not a composite one.
         */
        getCompositeSubInterfaces() {
            return this.composite ?? [];
        }

        /**
         * Checks whether this interface (or property) belongs to a group, i.e. it
         * carries the shared group reference.
         *
         * @returns {boolean} True if the interface (or property) is grouped.
         */
        isGrouped() {
            return this.group !== undefined;
        }

        /**
         * Checks whether this property is a member of a group property.
         *
         * @returns {boolean} True if the property is part of a group property.
         */
        isGroupProperty() {
            return this.groupProperty !== undefined;
        }

        /**
         * Finds a bus stub of this interface by its id.
         *
         * @param {string} id - The id of the stub to find.
         * @returns {Object|undefined} The stub with the given id, if found.
         */
        findBusStub(id) {
            return (this.bus?.stubs ?? []).find((stub) => stub.id === id);
        }

        /**
         * Checks whether this interface has a bus stub of the given id.
         *
         * @param {string} id - The id of the stub to look for.
         * @returns {boolean} True if the interface has a bus stub of the given id.
         */
        hasBusStub(id) {
            return this.findBusStub(id) !== undefined;
        }

        /**
         * Clears all bus stubs of this interface.
         */
        clearBusStubs() {
            if (this.bus && Array.isArray(this.bus.stubs)) {
                this.bus.stubs = [];
            }
        }

        /**
         * Builds a property descriptor for the `side` property of this
         * interface.
         *
         * @returns {Object} A property descriptor with `get`, `set`.
         */
        interfaceSideGetterSetter() {
            // for twoSided, each stub can have its' own side
            if (this.isOneSidedBus()) {
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
        // eslint-disable-next-line no-unused-vars
        preConnectionCheck(other, node, offset, stubID, stubSide) {
            if (this.isBusInterface()) {
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
         * @param {Object} connection - The connection to check, with `from` and `to` endpoints.
         * @returns {boolean} True if the interface (or one of its bus stubs) is an
         * endpoint of the connection.
         */
        isInConnection(connection) {
            if (this.isBusInterface()) {
                return this.bus?.stubs?.some((stub) =>
                    [connection.to, connection.from].some(
                        (end) => end === stub || end?.id === stub.id,
                    ));
            }
            if ((this.compositePorts ?? []).some((port) =>
                [connection.to, connection.from].some(
                    (end) => end === port || end?.id === port?.id,
                ))) {
                return true;
            }
            return [connection.to, connection.from].some(
                (end) => end === this || end?.id === this.id,
            );
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
         * @param {Object} node - The node that is being destroyed.
         */
        // eslint-disable-next-line class-methods-use-this, no-unused-vars
        onDestroy(node) { }
    }
    return Custom;
}

/**
 * A custom node interface that extends baklava's `NodeInterface`.
 */
export class CustomNodeInterface extends withCustomNodeFunctions(NodeInterface) { }
