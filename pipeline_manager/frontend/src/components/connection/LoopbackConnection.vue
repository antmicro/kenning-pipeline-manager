<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <path :d="d" :class="classes"></path>
</template>

<script>
import { Components } from '@baklavajs/plugin-renderer-vue';

export default {
    extends: Components.Connection,

    props: {
        nodeId: {
            type: String,
        },
        connLayer: {
            type: Number,
        },
        slope: {
            type: Number,
            default: 1,
        },
        shift: {
            type: Number,
            default: 30,
        },
    },

    methods: {
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
        calculateEllipseR(x, y, cx, cy, slope) {
            const rx = Math.sqrt(Math.abs((x - cx) * (x - cx) + ((x - cx) * (y - cy)) / slope));
            const ry = Math.sqrt(Math.abs((y - cy) * (y - cy) + (y - cy) * (x - cx) * slope));
            return [rx, ry];
        },
    },

    computed: {
        d() {
            const [tx1, ty1] = this.transform(this.x1, this.y1);
            const [tx2, ty2] = this.transform(this.x2, this.y2);
            if (this.plugin.useStraightConnections) {
                return `M ${tx1} ${ty1} L ${tx2} ${ty2}`;
            }

            const nodeHtml = document.getElementById(this.nodeId);
            const bottomY =
                (nodeHtml.offsetTop + nodeHtml.offsetHeight + this.plugin.panning.y) *
                this.plugin.scaling;
            const shift = this.shift * this.plugin.scaling;
            const y = bottomY + this.connLayer * shift;

            const rightCx = tx1 - this.connLayer * shift;
            const rightCy = (y + ty1) / 2;
            const [rightRx, rightRy] = this.calculateEllipseR(tx1, y, rightCx, rightCy, this.slope);

            const bottomCx = (tx1 + tx2) / 2;
            const bottomCy = bottomY;
            const [bottomRx, bottomRy] = this.calculateEllipseR(
                tx1,
                y,
                bottomCx,
                bottomCy,
                this.slope,
            );

            const leftCx = tx2 + this.connLayer * shift;
            const leftCy = (y + ty2) / 2;
            const [leftRx, leftRy] = this.calculateEllipseR(tx2, y, leftCx, leftCy, -this.slope);

            return `M ${tx1} ${ty1}
            A ${rightRx} ${rightRy} 0 0 1 ${tx1} ${y}
            A ${bottomRx} ${bottomRy} 0 0 1 ${tx2} ${y}
            A ${leftRx} ${leftRy} 0 0 1 ${tx2} ${ty2}`;
        },
    },
};
</script>
