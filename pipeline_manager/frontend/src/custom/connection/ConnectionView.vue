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
        <path :d="d" class="connection-wrapper baklava-connection"></path>
        <path :d="d" class="baklava-connection" :class="cssClasses"></path>
    </g>
</template>

<script>
import { defineComponent, computed } from 'vue';
import { Components } from 'baklavajs';

export default defineComponent({
    extends: Components.Connection,
    props: { isHighlighted: { default: false }, connection: { required: true } },
    setup(props) {
        const { d, classes } = Components.Connection.setup(props);
        const cssClasses = computed(() => ({ ...classes, '--hover': props.isHighlighted }));

        return { cssClasses, d };
    },
});
</script>
