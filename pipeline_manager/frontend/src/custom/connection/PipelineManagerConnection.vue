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
import { defineComponent, ref } from 'vue';
import { Components } from 'baklavajs';
import ConnectionView from './ConnectionView.vue';

export default defineComponent({
    extends: Components.ConnectionWrapper,
    props: { isHighlighted: { default: false } },
    components: { ConnectionView },
    setup(props) {
        const conn = ref(null);

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

        return {
            ...Components.ConnectionWrapper.setup(props),
            containsPoint,
            conn,
        };
    },
});
</script>
