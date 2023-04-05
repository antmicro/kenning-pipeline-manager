/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Editor } from '@baklavajs/core';
import { DummyConnection } from '@baklavajs/core';

export default class PipelineManagerEditor extends Editor {
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
            const tmp = from;
            from = to;
            to = tmp;
        }

        if (from.isInput || !to.isInput) {
            // connections are only allowed from input to output interface
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