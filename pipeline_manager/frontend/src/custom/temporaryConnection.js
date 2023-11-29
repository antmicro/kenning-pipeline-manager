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
    let hoveringOverElement = null;

    const onMouseMove = (ev) => {
        if (temporaryConnection.value) {
            // Touch does not support hover, check if event pointing on interface
            if (ev.pointerType === 'touch') {
                const element = document.elementFromPoint(ev.clientX, ev.clientY);
                // Hover out, trigger pointerout
                if (hoveringOverElement && hoveringOverElement !== element) {
                    hoveringOverElement.dispatchEvent(new PointerEvent('pointerout'));
                    hoveringOverElement = null;
                }
                // Hover over port, trigger pointerover
                if (element && element.classList.contains('__port')) {
                    element.dispatchEvent(new PointerEvent('pointerover'));
                    hoveringOverElement = element;
                }
                temporaryConnection.value.mx =
                    ev.clientX / graph.value.scaling - graph.value.panning.x;
                temporaryConnection.value.my =
                    ev.clientY / graph.value.scaling - graph.value.panning.y;
            } else {
                temporaryConnection.value.mx =
                    ev.offsetX / graph.value.scaling - graph.value.panning.x;
                temporaryConnection.value.my =
                    ev.offsetY / graph.value.scaling - graph.value.panning.y;
            }
        }
    };

    const onMouseDown = (ev) => {
        hoveringOverElement = ev.target;
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
