<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Component defining connection between two different nodes
Inherits from baklavajs/renderer-vue/src/connection/ConnectionView.vue
-->

<template>
    <g v-if="hasAnchors">
        <path :d="parsedNewD" class="connection-wrapper baklava-connection"></path>
        <!-- The connection wrapper is rendered twice, once for
            easy highlight detection, and once for creating anchor points -->

        <!-- eslint-disable vue/valid-v-for -->
        <template v-if="hasAnchors">
            <g
                v-for="(d, index) in parsedNewD"
                @pointerdown.left.exact="onMouseDown"
                @pointerdown.left.ctrl.exact="(ev) => onMouseShiftDown(ev, index)"
            >
            <path :d="d" class="connection-wrapper baklava-connection"></path>
            <path :d="d" class="baklava-connection" :class="cssClasses" :style="style"></path>
            </g>
            <Anchor
                v-for="(anchor, index) in connection.anchors"
                :key="anchor.id"
                :position="anchor"
                :rightclickCallback="() => removeAnchor(index)"
            />
        </template>
    </g>
    <g
        v-else
        @pointerdown.left.exact="onMouseDown"
        @pointerdown.left.ctrl.exact="(ev) => onMouseShiftDown(ev, 0)"
    >
        <path :d="parsedNewD" class="connection-wrapper baklava-connection"></path>
        <path :d="parsedNewD" class="baklava-connection" :class="cssClasses" :style="style"></path>
    </g>
</template>

<script>
import { defineComponent, computed } from 'vue';
import { Components, useGraph, useViewModel } from '@baklavajs/renderer-vue';
import doubleClick from '../../core/doubleClick';
import Anchor from '../../components/Anchor.vue';

/* eslint-disable vue/no-mutating-props,no-param-reassign */
export default defineComponent({
    extends: Components.Connection,
    props: { isHighlighted: { default: false }, connection: { required: true } },
    components: { Anchor },
    setup(props) {
        const { classes } = Components.Connection.setup(props);
        const { graph } = useGraph();
        const { viewModel } = useViewModel();
        const { interfaceTypes } = viewModel.value;

        const connectionStyle = interfaceTypes.getConnectionStyle(
            props.connection.from,
            props.connection.to,
        );

        const cssClasses = computed(() => ({
            ...classes.value,
            '--hover': props.isHighlighted,
            '--dashed': connectionStyle.interfaceConnectionPattern === 'dashed',
            '--dotted': connectionStyle.interfaceConnectionPattern === 'dotted',
        }));

        const style = computed(() => ({
            '--color': connectionStyle.interfaceConnectionColor,
        }));

        const onMouseDown = doubleClick(700, () => {
            if (!viewModel.value.editor.readonly) {
                graph.value.removeConnection(props.connection);
            }
        });

        const removeAnchor = (idx) => {
            props.connection.anchors.splice(idx, 1);
        };

        const onMouseShiftDown = (ev, index) => {
            if (viewModel.value.connectionRenderer.style !== 'orthogonal') return;
            if (props.connection.anchors === undefined) {
                props.connection.anchors = [];
            }
            // The index shows the connection section that was pressed -
            // since we have an extra one at the beginning, we need a -1 and a
            // division by 3 with no decimal to determine what anchor position
            // corresponds
            props.connection.anchors.splice(Math.trunc((index - 1) / 3), 0, {
                x: (ev.offsetX / graph.value.scaling) - graph.value.panning.x,
                y: (ev.offsetY / graph.value.scaling) - graph.value.panning.y,
                id: Date.now(),
            });
        };

        const transform = (x, y) => {
            const tx = (x + graph.value.panning.x) * graph.value.scaling;
            const ty = (y + graph.value.panning.y) * graph.value.scaling;
            return [tx, ty];
        };

        const newD = computed(() => {
            const [tx1, ty1] = transform(props.x1, props.y1);
            const [tx2, ty2] = transform(props.x2, props.y2);
            return viewModel.value.connectionRenderer.render(tx1, ty1, tx2, ty2, props.connection);
        });

        const parsedNewD = computed(() => {
            const d = newD.value;

            if (Array.isArray(d) && d.length) {
                const parsedArray = [];
                for (let i = 0; i < d.length - 1; i += 1) {
                    parsedArray.push(`M ${d[i].x} ${d[i].y} L ${d[i + 1].x} ${d[i + 1].y}`);
                }
                return parsedArray;
            }
            return d;
        });

        const hasAnchors = computed(() =>
            props.connection.anchors !== undefined &&
            props.connection.anchors.length &&
            viewModel.value.connectionRenderer.style === 'orthogonal',
        );

        return {
            cssClasses,
            parsedNewD,
            onMouseDown,
            onMouseShiftDown,
            style,
            hasAnchors,
            removeAnchor,
        };
    },
});
</script>
