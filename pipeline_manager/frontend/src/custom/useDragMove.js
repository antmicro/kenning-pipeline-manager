/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import { computed, ref } from 'vue';
import { useGraph } from 'baklavajs';
import gridSnapper from '../core/gridSnapper';

/* eslint-disable no-param-reassign */
export default function useDragMove(positionRef, gridSnapperInstance = undefined) {
    const { graph } = useGraph();

    const calculateSnappedPosition = gridSnapperInstance ?? gridSnapper(ref(1));

    const draggingStartPoint = ref(null);
    const draggingStartPosition = ref(null);

    const dragging = computed(() => !!draggingStartPoint.value);

    if (positionRef.value) {
        positionRef.value.x = calculateSnappedPosition(positionRef.value.x);
        positionRef.value.y = calculateSnappedPosition(positionRef.value.y);
    }

    const onPointerDown = (ev) => {
        draggingStartPoint.value = {
            x: ev.pageX,
            y: ev.pageY,
        };
        draggingStartPosition.value = {
            x: positionRef.value.x,
            y: positionRef.value.y,
        };
    };

    const onPointerMove = (ev) => {
        if (draggingStartPoint.value) {
            const dx = ev.pageX - draggingStartPoint.value.x;
            const dy = ev.pageY - draggingStartPoint.value.y;
            positionRef.value.x = calculateSnappedPosition(
                draggingStartPosition.value.x + dx / graph.value.scaling,
            );
            positionRef.value.y = calculateSnappedPosition(
                draggingStartPosition.value.y + dy / graph.value.scaling,
            );
        }
    };

    const onPointerUp = () => {
        draggingStartPoint.value = null;
        draggingStartPosition.value = null;
    };

    return {
        dragging,
        onPointerDown,
        onPointerMove,
        onPointerUp,
    };
}
