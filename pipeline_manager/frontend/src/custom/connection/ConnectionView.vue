<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Component defining connection between two different nodes

Inherits from baklavajs-plugin-renderer-vue/src/components/connection/ConnectionView.vue
-->

<template>
    <g>
        <path :d="d" class="connection-wrapper"></path>
        <path :d="d" :class="cssClasses"></path>
    </g>
</template>

<script>
import { Components } from '@baklavajs/plugin-renderer-vue';

export default {
    extends: Components.Connection,
    props: ['isHighlighted'],

    computed: {
        cssClasses() {
            return { ...this.classes, '--hover': this.isHighlighted };
        },
    },
};
</script>
