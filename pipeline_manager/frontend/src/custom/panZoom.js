/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
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

    // The limit for zooming that does not allow for zooming if
    // `zoomLimit` number of graphs would fit into the editor
    // vertically or horizontally.
    const zoomLimit = 2;

    const panningRef = computed(() => graph.value.panning);
    const dragMove = useDragMove(panningRef);

    const applyZoom = (centerX, centerY, newScale) => {
        if (newScale <= 0) {
            return;
        }

        const currentPoint = [
            centerX / graph.value.scaling - graph.value.panning.x,
            centerY / graph.value.scaling - graph.value.panning.y,
        ];
        const newPoint = [
            centerX / newScale - graph.value.panning.x,
            centerY / newScale - graph.value.panning.y,
        ];
        const diff = [newPoint[0] - currentPoint[0], newPoint[1] - currentPoint[1]];

        const editorHeight = window.innerHeight;
        const editorWidth = window.innerWidth;

        const allowZoomOut =
            zoomLimit * graph.value.size().graphWidth > editorWidth / newScale ||
            zoomLimit * graph.value.size().graphHeight > editorHeight / newScale ||
            (
                newScale > graph.value.scaling &&
                graph.value.size().graphHeight !== -Infinity
            );

        if (allowZoomOut) {
            graph.value.scaling = newScale;
            graph.value.panning.x += diff[0];
            graph.value.panning.y += diff[1];
        }
    };

    const calculateScale = (scrollDelta) => {
        const smallerGraph = graph.value.size().graphWidth < 500 ||
        graph.value.size().graphHeight < 500;

        // For smaller graphs, allow the larger scale than for larger graphs.
        const upperLimitOfScale = smallerGraph ? 2.5 : 1.5;

        const newScale = graph.value.scaling * (1 - scrollDelta / 3000);
        return Math.min(newScale, upperLimitOfScale);
    };

    const onMouseWheel = (ev) => {
        if (ev.target.type === 'textarea' && ev.target.className === 'baklava-input') {
            return;
        }

        ev.preventDefault();
        let scrollAmount = ev.deltaY;
        if (ev.deltaMode === 1) {
            scrollAmount *= 32; // Firefox fix, multiplier is trial & error
        }

        // Limit the zooming.
        const newScale = calculateScale(scrollAmount);

        applyZoom(ev.clientX, ev.clientY, newScale);
    };

    const getCoordsFromCache = () => ({
        ax: pointerCache[0].clientX,
        ay: pointerCache[0].clientY,
        bx: pointerCache[1].clientX,
        by: pointerCache[1].clientY,
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
