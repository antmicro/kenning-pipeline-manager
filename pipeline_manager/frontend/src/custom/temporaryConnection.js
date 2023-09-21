/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

/**
 * Module used to handle user interaction with connections and interfaces.
 * It is heavily baklava implementation based.
 */

import { provide, ref } from 'vue';
import { useGraph } from '@baklavajs/renderer-vue';

/**
 * This enum class is based on baklavajs enum `TemporaryConnectionState`
 * and is compatible with it as it is unimportable in baklavajs sources
 */
export const TemporaryConnectionState = {
    NONE: 0,
    ALLOWED: 1,
    FORBIDDEN: 2,
};

export function useTemporaryConnection() {
    const { graph } = useGraph();

    const temporaryConnection = ref(null);
    const hoveringOver = ref(null);

    const onMouseMove = (ev) => {
        if (temporaryConnection.value) {
            temporaryConnection.value.mx = ev.offsetX / graph.value.scaling - graph.value.panning.x;
            temporaryConnection.value.my = ev.offsetY / graph.value.scaling - graph.value.panning.y;
        }
    };

    const onMouseDown = () => {
        if (hoveringOver.value) {
            temporaryConnection.value = {
                status: TemporaryConnectionState.NONE,
                from: hoveringOver.value,
                to: hoveringOver.value,
            };

            temporaryConnection.value.mx = undefined;
            temporaryConnection.value.my = undefined;
        }
    };

    const onMouseUp = () => {
        if (temporaryConnection.value && hoveringOver.value) {
            graph.value.addConnection(temporaryConnection.value.from, temporaryConnection.value.to);
        }
        temporaryConnection.value = null;
    };

    const hoveredOver = (ni) => {
        hoveringOver.value = ni ?? null;
        if (ni && temporaryConnection.value) {
            temporaryConnection.value.to = ni;
            const checkConnectionResult = graph.value.checkConnection(
                temporaryConnection.value.from,
                temporaryConnection.value.to,
            );
            temporaryConnection.value.status = checkConnectionResult.connectionAllowed
                ? TemporaryConnectionState.ALLOWED
                : TemporaryConnectionState.FORBIDDEN;

            if (checkConnectionResult.connectionAllowed) {
                const ids = checkConnectionResult.connectionsInDanger.map((c) => c.id);
                graph.value.connections.forEach((c) => {
                    if (ids.includes(c.id)) {
                        c.isInDanger = true; // eslint-disable-line no-param-reassign
                    }
                });
            }
        } else if (!ni && temporaryConnection.value) {
            temporaryConnection.value.to = undefined;
            temporaryConnection.value.status = TemporaryConnectionState.NONE;
            graph.value.connections.forEach((c) => {
                c.isInDanger = false; // eslint-disable-line no-param-reassign
            });
        }
    };

    provide('hoveredOver', hoveredOver);

    return {
        temporaryConnection,
        onMouseMove,
        onMouseDown,
        onMouseUp,
    };
}
