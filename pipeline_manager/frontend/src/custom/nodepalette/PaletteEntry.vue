<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
A single entry representing available node type in the sidebar.
-->
<template>
    <div class="__entry __node-entry" :class="draggedClass" :style="padding">
        <img class="__title-icon" v-if="nodeIcon !== undefined" :src="nodeIcon" />
        <div class="__title-label">
            {{ title }}
        </div>
        <a
            v-for="url in urls"
            :key="url.name"
            :href="url.url"
            class="__url"
            :class="openClass"
            @pointerdown.stop
            @pointerover="hover = true"
            @pointerleave="hover = false"
            target="_blank"
        >
            <img
                v-if="getIconPath(url.icon) !== undefined"
                :src="getIconPath(url.icon)"
                :alt="url.name"
            />
            <div class="__tooltip">{{ url.name }}</div>
        </a>
    </div>
</template>

<script>
import { defineComponent, computed, ref } from 'vue';

export default defineComponent({
    props: {
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
        urls: {
            default: [],
        },
        isDragged: {
            type: Boolean,
            default: false,
        },
    },
    setup(props) {
        const getIconPath = (name) => (name !== undefined ? `./assets/${name}` : undefined);

        const nodeIcon = computed(() => getIconPath(props.iconPath));
        const paddingDepth = 20;
        const minPadding = 10;
        const padding = computed(
            () => `padding-left: ${minPadding + props.depth * paddingDepth}px`,
        );
        const draggedClass = computed(() => ({
            __dragged: props.isDragged,
        }));

        const hover = ref(false);
        const openClass = computed(() => ({ open: hover.value }));

        return {
            nodeIcon,
            padding,
            draggedClass,
            getIconPath,
            hover,
            openClass,
        };
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
