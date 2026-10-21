/*
 * Copyright (c) 2026 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

/**
 * Module used to handle composite interfaces. Global mapping and utilities for loading composites.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Map of a composite type name to the list of its sub-interface definitions.
 * @type {Map<string, Array>}
 */
const interfaceCompositeTypes = new Map();

/**
 * (Re)loads the composite interface definitions from the specification.
 *
 * @param {Object|undefined} composites Contents of the specification's
 * `interfaceComposites` field. Invalid entries are ignored, as they are
 * reported by the schema validation already.
 */
export function setInterfaceCompositeTypes(composites) {
    interfaceCompositeTypes.clear();
    Object.entries(composites ?? {}).forEach(([name, definition]) => {
        if (Array.isArray(definition) && definition.length > 0) {
            interfaceCompositeTypes.set(name, definition);
        }
    });
}

/**
 * Removes all composite interface definitions.
 */
export function clearInterfaceCompositeTypes() {
    interfaceCompositeTypes.clear();
}

/**
 * Returns the sub-interface definitions of the composite of a given type name.
 *
 * @param {string} typeName - Name of the composite type.
 * @returns {Array|undefined} The list of sub-interface definitions, or
 * undefined when `typeName` does not name a composite.
 */
export function getInterfaceCompositeType(typeName) {
    return interfaceCompositeTypes.get(typeName);
}

/**
 * Resolves the composite definition of an interface definition.
 *
 * An interface is a composite one when one of its types names a composite
 * defined in the specification. Every sub-interface is given its own `id`
 * (analogously to the bus stubs), so the instances created out of the same
 * definition are distinguishable, and a `direction`, defaulting to the one of
 * the parent interface.
 *
 * @param {Object} io - Interface-like object with an optional `type` field
 * (either a string or a list of strings).
 * @returns {Object|undefined} A `{ type, interfaces }` object, or undefined
 * when the interface is not a composite one.
 */
export function resolveComposite(io) {
    if (io === undefined) return undefined;

    const types = Array.isArray(io.type) ? io.type : [io.type];
    const type = types.find((t) => interfaceCompositeTypes.has(t));
    if (type === undefined) return undefined;

    const direction = io.direction ?? 'inout';
    const interfaces = getInterfaceCompositeType(type).map((sub) => ({
        ...structuredClone(sub),
        id: uuidv4(),
        direction: sub.direction ?? direction,
    }));

    return { type, interfaces };
}
