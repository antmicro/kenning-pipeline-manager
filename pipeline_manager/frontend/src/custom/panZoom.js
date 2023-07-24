/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { computed } from 'vue';
import { useGraph } from '@baklavajs/renderer-vue';
import useDragMove from './useDragMove';

export default function usePanZoom() {
    const { graph } = useGraph();

    // State needed for pinch-zoom
    let pointerCache = [];
    let prevDiff = -1;
    let midpoint = { x: 0, y: 0 };

    const panningRef = computed(() => graph.value.panning);
    const dragMove = useDragMove(panningRef);

    const applyZoom = (centerX, centerY, newScale) => {
        const currentPoint = [
            centerX / graph.value.scaling - graph.value.panning.x,
            centerY / graph.value.scaling - graph.value.panning.y,
        ];
        const newPoint = [
            centerX / newScale - graph.value.panning.x,
            centerY / newScale - graph.value.panning.y,
        ];
        const diff = [newPoint[0] - currentPoint[0], newPoint[1] - currentPoint[1]];
        graph.value.scaling = newScale;
        graph.value.panning.x += diff[0];
        graph.value.panning.y += diff[1];
    };

    const onMouseWheel = (ev) => {
        ev.preventDefault();
        let scrollAmount = ev.deltaY;
        if (ev.deltaMode === 1) {
            scrollAmount *= 32; // Firefox fix, multiplier is trial & error
        }
        const newScale = graph.value.scaling * (1 - scrollAmount / 3000);
        applyZoom(ev.offsetX, ev.offsetY, newScale);
    };

    const getCoordsFromCache = () => ({
        ax: pointerCache[0].offsetX,
        ay: pointerCache[0].offsetY,
        bx: pointerCache[1].offsetX,
        by: pointerCache[1].offsetY,
    });

    const onPointerDown = (ev) => {
        dragMove.onPointerDown(ev);

        if (pointerCache.length <= 1) {
            pointerCache.push(ev);
        }

        if (pointerCache.length === 2) {
            const { ax, ay, bx, by } = getCoordsFromCache(); // eslint-disable-line object-curly-newline,max-len
            const dx = ax - bx;
            const dy = ay - by;
            prevDiff = Math.sqrt(dx * dx + dy * dy);

            midpoint = {
                x: ax + (bx - ax) / 2,
                y: ay + (by - ay) / 2,
            };
        }
    };

    const onPointerMove = (ev) => {
        if (pointerCache.length === 2) {
            for (let i = 0; i < pointerCache.length; i += 1) {
                if (ev.pointerId === pointerCache[i].pointerId) {
                    pointerCache[i] = ev;
                    break;
                }
            }

            const { ax, ay, bx, by } = getCoordsFromCache(); // eslint-disable-line object-curly-newline,max-len
            const dx = ax - bx;
            const dy = ay - by;
            const curDiff = Math.sqrt(dx * dx + dy * dy);

            if (prevDiff > 0) {
                const newScale = graph.value.scaling * (1 + (curDiff - prevDiff) / 500);
                applyZoom(midpoint.x, midpoint.y, newScale);
            }

            // Cache the distance for the next move event
            prevDiff = curDiff;
        } else {
            dragMove.onPointerMove(ev);
        }
    };

    const onPointerUp = (ev) => {
        dragMove.onPointerUp();

        pointerCache = pointerCache.filter((p) => p.pointerId !== ev.pointerId);
        prevDiff = -1;
    };

    return {
        ...dragMove,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onMouseWheel,
    };
}
