<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <path :d="d" :class="cssClasses"></path>
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
