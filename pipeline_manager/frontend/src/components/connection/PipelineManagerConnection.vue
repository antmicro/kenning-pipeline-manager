<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
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
    ></component>
</template>

<script>
import { Components } from '@baklavajs/plugin-renderer-vue';
import LoopbackConnection from './LoopbackConnection.vue';

export default {
    extends: Components.ConnectionWrapper,

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
