/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import { computed, ref } from 'vue';
import { useGraph, useViewModel } from '@baklavajs/renderer-vue';
import { gridSnapper, nodeSnapper } from '../core/snappers';

/* eslint-disable no-param-reassign */
export default function useDragMove(
    positionRef,
    gridSnapperInstance = undefined,
    nodeId = undefined,
) {
    const { graph } = useGraph();
    const { viewModel } = useViewModel();

    const calculateSnappedPosition = gridSnapperInstance ?? gridSnapper(ref(1));

    const gridSize = computed(() => viewModel.value.settings.background.gridSize);
    const backgroundGridSnapper = gridSnapper(gridSize);

    const nodeSnappers = {
        x: nodeSnapper('x'),
        y: nodeSnapper('y'),
    };

    const draggingStartPoint = ref(null);
    const draggingStartPosition = ref(null);
    const movementStepEnabled = ref(true);

    const dragging = computed(() => !!draggingStartPoint.value);

    /* eslint-disable arrow-body-style */
    const calculatePosition = (pos, kind, align = false, gridSnap = false) => {
        if (align && nodeId !== undefined) {
            const alignedCoord = nodeSnappers[kind](pos, nodeId);
            if (alignedCoord !== undefined) {
                return alignedCoord;
            }
        }

        if (gridSnap) {
            return backgroundGridSnapper(pos);
        }
        // allow either snap-to-grid or free movement
        return movementStepEnabled.value ? calculateSnappedPosition(pos) : pos;
    };
    /* eslint-enable arrow-body-style */

    if (positionRef.value) {
        positionRef.value.x = calculatePosition(positionRef.value.x, 'x');
        positionRef.value.y = calculatePosition(positionRef.value.y, 'y');
    }

    const onPointerDown = (ev) => {
        movementStepEnabled.value = !ev.shiftKey;
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
        movementStepEnabled.value = !ev.shiftKey;
        const align = ev.ctrlKey;
        const gridSnap = ev.shiftKey;
        if (draggingStartPoint.value) {
            const dx = ev.pageX - draggingStartPoint.value.x;
            const dy = ev.pageY - draggingStartPoint.value.y;
            positionRef.value.x = calculatePosition(
                draggingStartPosition.value.x + dx / graph.value.scaling,
                'x',
                align,
                gridSnap,
            );
            positionRef.value.y = calculatePosition(
                draggingStartPosition.value.y + dy / graph.value.scaling,
                'y',
                align,
                gridSnap,
            );
        }
    };

    const onPointerUp = () => {
        draggingStartPoint.value = null;
        draggingStartPosition.value = null;
        movementStepEnabled.value = true;
    };

    return {
        dragging,
        onPointerDown,
        onPointerMove,
        onPointerUp,
    };
}
