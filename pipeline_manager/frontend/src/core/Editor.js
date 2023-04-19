/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Custom pipeline editor - Implements logic for adding, removing, editing nodes and
 * conections between them.
 * Inherits from baklavajs-core/src/editor.ts
 */

/*
 * Custom pipeline editor - Implements logic for adding, removing, editing nodes and
 * conections between them.
 * Inherits from baklavajs-core/src/editor.ts
 */

import { Editor, DummyConnection } from '@baklavajs/core';

export default class PipelineManagerEditor extends Editor {
    allowLoopbacks = false;

    /**
     * Checks, whether a connection between two node interfaces would be valid.
     * @param from The starting node interface (must be an output interface)
     * @param to The target node interface (must be an input interface)
     * @returns Whether the connection is allowed or not.
     */
    checkConnection(from, to) {
        if (!from || !to) {
            return false;
        }

        if (from.isInput && !to.isInput) {
            // reverse connection
            /* eslint-disable no-param-reassign */
            const tmp = from;
            from = to;
            to = tmp;
            /* eslint-enable no-param-reassign */
        }

        if (from.isInput || !to.isInput) {
            // connections are only allowed from input to output interface
            return false;
        }

        if (from.parent === to.parent && !this.allowLoopbacks) {
            // Connection starting and ending at the same node are only allowed if corresponding
            // option is set to true
            return false;
        }

        // prevent duplicate connections
        if (this.connections.some((c) => c.from === from && c.to === to)) {
            return false;
        }

        if (this.events.checkConnection.emit({ from, to })) {
            return false;
        }

        return new DummyConnection(from, to);
    }
}
