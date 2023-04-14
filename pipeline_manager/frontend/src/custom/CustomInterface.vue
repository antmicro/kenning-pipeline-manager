<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div :id="data.id" :class="classes">
        <div class="__port" @mouseover="startHoverWrapper" @mouseout="endHoverWrapper"></div>
        <span
            v-if="data.connectionCount > 0 || !data.option || !getOptionComponent(data.option)"
            class="align-middle"
        >
            {{ displayName }}
        </span>
        <component
            v-else
            :is="getOptionComponent(data.option)"
            :option="data"
            :value="value"
            @input="data.value = $event"
            :name="displayName"
        ></component>
    </div>
</template>

<script>
import { Components } from '@baklavajs/plugin-renderer-vue';

export default {
    extends: Components.NodeInterface,
    methods: {
        /**
         * Wrapper for startHover function.
         * It checks whether the interface is in read-only mode.
         * If it is then it disables event handling.
         */
        startHoverWrapper() {
            if (!this.plugin.editor.readonly) {
                this.startHover();
            }
        },
        /**
         * Wrapper for endHover function.
         * It checks whether the interface is in read-only mode.
         * If it is then it disables event handling.
         */
        endHoverWrapper() {
            if (!this.plugin.editor.readonly) {
                this.endHover();
            }
        },
    },
};
</script>
