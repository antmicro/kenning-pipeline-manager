/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import { Ref } from 'vue';
import { useGraph } from '@baklavajs/renderer-vue';
import useDragMove from './useDragMove';

interface coordinates {
    x: number;
    y: number;
}

/* eslint-disable no-param-reassign, @typescript-eslint/no-explicit-any */
export default function useGroupDragMove(
    dragRootNodePosition: Ref<coordinates>,
    dragRootNodeId = undefined,
    gridSnapperInstance = undefined,
) {
    const { graph } = useGraph() as { graph: any };

    const groupDragMove = useDragMove(
        dragRootNodePosition,
        gridSnapperInstance,
        dragRootNodeId,
    );

    const groupPointerMove = groupDragMove.onPointerMove;

    const onPointerMove = (ev: PointerEvent) => {
        const groupPositionCoords = {
            x: dragRootNodePosition.value.x,
            y: dragRootNodePosition.value.y,
        };

        groupPointerMove(ev);

        const dx = dragRootNodePosition.value.x - groupPositionCoords.x;
        const dy = dragRootNodePosition.value.y - groupPositionCoords.y;

        graph.value.selectedNodes.forEach((node: any) => {
            if (node.id !== dragRootNodeId) {
                node.position.x += dx;
                node.position.y += dy;
            }
        });
    };

    groupDragMove.onPointerMove = onPointerMove;

    return groupDragMove;
}
