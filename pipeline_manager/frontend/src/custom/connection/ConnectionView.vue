<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Component defining connection between two different nodes
Inherits from baklavajs/renderer-vue/src/connection/ConnectionView.vue
-->

<template>
    <g @pointerdown="onMouseDown">
        <path :d="newD" class="connection-wrapper baklava-connection"></path>
        <path :d="newD" class="baklava-connection" :class="cssClasses" :style="style"></path>
    </g>
</template>

<script>
import { defineComponent, computed } from 'vue';
import { Components, useGraph, useViewModel } from 'baklavajs';
import doubleClick from '../../core/doubleClick';

export default defineComponent({
    extends: Components.Connection,
    props: { isHighlighted: { default: false }, connection: { required: true } },
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
            graph.value.removeConnection(props.connection);
        });

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

        return {
            cssClasses,
            newD,
            onMouseDown,
            style,
        };
    },
});
</script>
