<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="__entry __node-entry" :class="draggedClass" :style="padding">
        <img class="__title-icon" v-if="nodeIcon !== undefined" :src="nodeIcon" />
        <div class="__title-label">
            {{ title }}
        </div>
    </div>
</template>

<script>
import { defineComponent, computed } from 'vue';

export default defineComponent({
    props: {
        type: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        iconPath: {
            type: String,
            required: false,
        },
        depth: {
            type: Number,
            required: true,
        },
        isDragged: {
            type: Boolean,
            default: false,
        },
    },
    setup(props) {
        const nodeIcon = props.iconPath !== undefined ? `./assets/${props.iconPath}` : undefined;
        const paddingDepth = 20;
        const minPadding = 10;
        const padding = computed(
            () => `padding-left: ${minPadding + props.depth * paddingDepth}px`,
        );
        const draggedClass = computed(() => ({
            __dragged: props.isDragged,
        }));

        return { nodeIcon, padding, draggedClass };
    },
});
</script>

<style lang="scss" scoped>
.__node-entry {
    cursor: grab;
}

.__dragged {
    border-radius: var(--baklava-node-border-radius);
    border-width: 0px;
}
</style>
