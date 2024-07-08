/*
 * Copyright (c) 2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Class used to store the current specification and unresolved specification
 * of the current session.
 *
 * This class should be used as a singleton and should be accessed using the
 * getInstance() function.
 */
import { GRAPH_NODE_TYPE_PREFIX } from '@baklavajs/core';

export default class Specification {
    static instance = undefined;

    currentSpecification = undefined;

    unresolvedSpecification = undefined;

    constructor() {
        if (Specification.instance !== undefined) {
            throw new Error('Error - use Specification.getInstance()');
        }
    }

    /**
     * Static function used to get the instance of the Specification in a singleton manner.
     * If there is no existing instance of the Specification then a new one is created.
     *
     * @returns Instance of Specification.
     */
    static getInstance() {
        if (!Specification.instance) {
            Specification.instance = new Specification();
        }
        return Specification.instance;
    }

    /**
     * Searches the current specification for a node with the given name.
     *
     * @param nodeName name of the node that is to be found in the specification
     * @returns the specification of the node if it exists, otherwise undefined
     */
    getNodeSpecification(nodeName) {
        if (this.currentSpecification === undefined) return undefined;

        if (nodeName.startsWith(GRAPH_NODE_TYPE_PREFIX)) {
            return this.currentSpecification.graphs.find(
                (n) => n.name === nodeName.slice(GRAPH_NODE_TYPE_PREFIX.length),
            );
        }

        return this.currentSpecification.nodes.find(
            (n) => n.name === nodeName,
        );
    }
}
