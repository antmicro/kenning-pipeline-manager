<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Wraps the connection, defines it's type and parameters.
Inherits from baklavajs/renderer-vue/src/connection/ConnectionView.vue
-->

<template>
    <component
        ref="conn"
        :is="connectionType"
        :x1="d.x1"
        :y1="d.y1"
        :x2="d.x2"
        :y2="d.y2"
        :state="state"
        :connection="connection"
        :isHighlighted="isHighlighted"
    ></component>
</template>

<script>
import { defineComponent, computed, ref } from 'vue';
import { Components, useGraph } from 'baklavajs';
import LoopbackConnection from './LoopbackConnection.vue';
import ConnectionView from './ConnectionView.vue';

export default defineComponent({
    extends: Components.ConnectionWrapper,
    props: { isHighlighted: { default: false } },
    setup(props) {
        const { graph } = useGraph();

        const conn = ref(null);

        const fromNodePosition = computed(
            () => graph.value.findNodeById(props.connection.from.nodeId)?.position,
        );
        const toNodePosition = computed(
            () => graph.value.findNodeById(props.connection.to.nodeId)?.position,
        );

        /**
         * Check whether the connection path contains the x, y point
         *
         * @param x X coordinate of input point
         * @param y Y coordinate of input point
         */
        const containsPoint = (x, y) => {
            const elements = document.elementsFromPoint(x, y);
            return elements.includes(conn.value.$el.firstChild);
        };

        const isLoopback = computed(() => fromNodePosition.value === toNodePosition.value);
        const connectionType = computed(() => {
            if (isLoopback.value) {
                return LoopbackConnection;
            }
            return ConnectionView;
        });

        return {
            ...Components.ConnectionWrapper.setup(props),
            connectionType,
            containsPoint,
            conn,
        };
    },
});
</script>
