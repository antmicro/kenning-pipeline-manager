<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0

Wraps the connection, defines it's type and parameters.
Inherits from baklavajs-plugin-renderer-vue/src/components/connection/ConnectionView.vue
-->

<!--
Wraps the connection, defines it's type and parameters.
Inherits from baklavajs-plugin-renderer-vue/src/components/connection/ConnectionView.vue
-->

<template>
    <component
        :is="connectionType"
        :x1="d.x1"
        :y1="d.y1"
        :x2="d.x2"
        :y2="d.y2"
        :state="state"
        :connection="connection"
        :data-from="connection.from.id"
        :data-to="connection.to.id"
        :data-from-node="connection.from.parent.id"
        :data-to-node="connection.to.parent.id"
        :is-highlighted="isHighlighted"
    ></component>
</template>

<script>
import { Components } from '@baklavajs/plugin-renderer-vue';
import LoopbackConnection from './LoopbackConnection.vue';

export default {
    extends: Components.ConnectionWrapper,

    props: {
        isHighlighted: {
            type: Boolean,
            default: false
        }
    },

    methods: {
        containsPoint(x, y) {
            const elements = document.elementsFromPoint(x, y);
            return elements.includes(this.$children[0].$el);
        }
    },

    computed: {
        isLoopback() {
            return this.connection.from.parent.id === this.connection.to.parent.id;
        },

        connectionType() {
            if (this.isLoopback) {
                return LoopbackConnection;
            }
            return Components.Connection;
        },
    },
};
</script>
