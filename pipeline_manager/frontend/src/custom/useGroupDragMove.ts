/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 */

import { ref, Ref } from 'vue';
import { useGraph } from '@baklavajs/renderer-vue';
import useDragMove from './useDragMove';

interface coordinates {
    x: number;
    y: number;
}

/* eslint-disable no-param-reassign, @typescript-eslint/no-explicit-any */
export default function useGroupDragMove(
    dragRootNodePosition: Ref<coordinates>,
    gridSnapperInstance = undefined,
) {
    const { graph } = useGraph() as { graph: any };
    const selectedNodesPositions = graph.value.selectedNodes.map(
        (node: { position: coordinates; }) => node.position,
    );

    const groupPositionCoords: Ref<coordinates> = ref(
        { x: dragRootNodePosition.value.x, y: dragRootNodePosition.value.y },
    );

    const groupDragMove = useDragMove(
        groupPositionCoords,
        gridSnapperInstance,
        graph.value.selectedNodes.map((node: { id: string }) => node.id),
    );

    const groupPointerMove = groupDragMove.onPointerMove;

    const onPointerMove = (ev: PointerEvent) => {
        groupPointerMove(ev);

        const dx = groupPositionCoords.value.x - dragRootNodePosition.value.x;
        const dy = groupPositionCoords.value.y - dragRootNodePosition.value.y;

        selectedNodesPositions.forEach((pos: coordinates) => {
            pos.x += dx;
            pos.y += dy;
        });
    };

    groupDragMove.onPointerMove = onPointerMove;

    return groupDragMove;
}
