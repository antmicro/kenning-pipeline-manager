<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0

Subcomponent of BaklavaJS connection representing loopback connections - going
from output to the input of the same node.
Inherits from baklavajs-plugin-renderer-vue/src/components/connection/ConnectionView.vue
-->

<!--
Subcomponent of BaklavaJS connection representing loopback connections - going
from output to the input of the same node.
Inherits from baklavajs-plugin-renderer-vue/src/components/connection/ConnectionView.vue
-->

<template>
    <g>
        <path :d="loopbackd" class="connection-wrapper baklava-connection"></path>
        <path :d="loopbackd" class="baklava-connection" :class="cssClasses"></path>
    </g>
</template>

<script>
import { defineComponent, computed } from 'vue';
import { useGraph, useViewModel } from 'baklavajs';
import ConnectionView from './ConnectionView.vue';

export default defineComponent({
    extends: ConnectionView,
    props: {
        slope: {
            default: 1,
            type: Number,
        },
        shift: {
            type: Number,
            default: 30,
        },
    },
    setup(props) {
        const { d, cssClasses } = ConnectionView.setup(props);

        const { graph } = useGraph();
        const { viewModel } = useViewModel();

        /**
         * Function that calculates the x and y radius of an ellipse given center point and
         * a slope at a specified point
         *
         * @param x X coordinate of a point on an ellipse
         * @param y Y coordinate of a point on an ellipse
         * @param cx X coordinate of a center point
         * @param cy Y coordinate of a center point
         * @param slope dy/dx value on a (x, y) point
         * @returns Array of two elements: radius parallel to x axis and y axis respectively
         */
        const calculateEllipseR = (x, y, cx, cy, slope) => {
            const rx = Math.sqrt(Math.abs((x - cx) * (x - cx) + ((x - cx) * (y - cy)) / slope));
            const ry = Math.sqrt(Math.abs((y - cy) * (y - cy) + (y - cy) * (x - cx) * slope));
            return [rx, ry];
        };

        const nodeId = computed(() => props.connection.to.nodeId);

        const nodeObject = computed(() => graph.value.findNodeById(nodeId.value));

        const transform = (x, y) => {
            const tx = (x + graph.value.panning.x) * graph.value.scaling;
            const ty = (y + graph.value.panning.y) * graph.value.scaling;
            return [tx, ty];
        };

        const connLayer = computed(
            () =>
                Object.values(nodeObject.value.outputs)
                    .filter((conn) => conn.port)
                    .reverse()
                    .indexOf(props.connection.from) + 1,
        );

        const loopbackd = computed(() => {
            const [tx1, ty1] = transform(props.x1, props.y1);
            const [tx2, ty2] = transform(props.x2, props.y2);
            if (viewModel.value.settings.useStraightConnections) {
                return `M ${tx1} ${ty1} L ${tx2} ${ty2}`;
            }

            const nodeHtml = document.getElementById(nodeId.value);
            const nodeBottom = nodeHtml ? nodeHtml.offsetTop + nodeHtml.offsetHeight : 0;
            const bottomY = (nodeBottom + graph.value.panning.y) * graph.value.scaling;
            const shift = props.shift * graph.value.scaling;
            const y = bottomY + connLayer.value * shift;

            const rightCx = tx1 - connLayer.value * shift;
            const rightCy = (y + ty1) / 2;
            const [rightRx, rightRy] = calculateEllipseR(tx1, y, rightCx, rightCy, props.slope);

            const bottomCx = (tx1 + tx2) / 2;
            const bottomCy = bottomY;
            const [bottomRx, bottomRy] = calculateEllipseR(tx1, y, bottomCx, bottomCy, props.slope);

            const leftCx = tx2 + connLayer.value * shift;
            const leftCy = (y + ty2) / 2;
            const [leftRx, leftRy] = calculateEllipseR(tx2, y, leftCx, leftCy, -props.slope);

            return `M ${tx1} ${ty1}
            A ${rightRx} ${rightRy} 0 0 1 ${tx1} ${y}
            A ${bottomRx} ${bottomRy} 0 0 1 ${tx2} ${y}
            A ${leftRx} ${leftRy} 0 0 1 ${tx2} ${ty2}`;
        });

        return { loopbackd, cssClasses };
    },
});
</script>
