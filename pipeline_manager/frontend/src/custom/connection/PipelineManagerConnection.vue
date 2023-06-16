<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Wraps the connection, defines it's type and parameters.
Inherits from baklavajs/renderer-vue/src/connection/ConnectionView.vue
-->

<template>
    <ConnectionView
        ref="conn"
        :x1="d.x1"
        :y1="d.y1"
        :x2="d.x2"
        :y2="d.y2"
        :state="state"
        :connection="connection"
        :isHighlighted="isHighlighted"
    ></ConnectionView>
</template>

<script>
import { defineComponent, ref, computed, watch } from 'vue'; // eslint-disable-line object-curly-newline
import { Components, useGraph } from 'baklavajs';
import ConnectionView from './ConnectionView.vue';
import getDomElements from './domResolver';

export default defineComponent({
    extends: Components.ConnectionWrapper,
    props: { isHighlighted: { default: false } },
    components: { ConnectionView },
    setup(props) {
        const conn = ref(null);
        const { graph } = useGraph();
        const { d, state } = Components.ConnectionWrapper.setup(props);

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

        const fromNode = computed(() => graph.value.findNodeById(props.connection.from.nodeId));
        const toNode = computed(() => graph.value.findNodeById(props.connection.to.nodeId));

        const fromNodeInterfacesSide = computed(() =>
            [
                ...Object.values(fromNode.value?.inputs ?? {}),
                ...Object.values(fromNode.value?.outputs ?? {}),
            ].map((io) => io.side),
        );
        const toNodeInterfacesSide = computed(() =>
            [
                ...Object.values(toNode.value?.inputs ?? {}),
                ...Object.values(toNode.value?.outputs ?? {}),
            ].map((io) => io.side),
        );

        const getPortCoordinates = (resolved) => {
            if (resolved.node && resolved.interface && resolved.port) {
                return [
                    resolved.node.offsetLeft +
                        resolved.interface.offsetLeft +
                        resolved.port.offsetLeft +
                        resolved.port.clientWidth / 2,
                    resolved.node.offsetTop +
                        resolved.interface.offsetTop +
                        resolved.port.offsetTop +
                        resolved.port.clientHeight / 2,
                ];
            }
            return [0, 0];
        };

        const updateCoords = () => {
            const from = getDomElements(props.connection.from);
            const to = getDomElements(props.connection.to);

            const [x1, y1] = getPortCoordinates(from);
            const [x2, y2] = getPortCoordinates(to);
            d.value = {
                x1,
                y1,
                x2,
                y2,
            };
        };

        // If any side of any interface in from or to node changes we may need to
        // Rerender connections
        watch([fromNodeInterfacesSide, toNodeInterfacesSide], () => updateCoords());

        return {
            d,
            state,
            containsPoint,
            conn,
        };
    },
});
</script>
