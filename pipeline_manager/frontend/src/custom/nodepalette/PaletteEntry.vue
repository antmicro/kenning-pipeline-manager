<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
A single entry representing available node type in the sidebar.
-->
<template>
    <div class="__entry __node-entry" :class="draggedClass" :style="padding">
        <img class="__title-icon" v-if="nodeIcon !== undefined" :src="nodeIcon" draggable="false" />
        <div class="__title-label" v-html="title">
        </div>
        <a
            v-for="url in urls"
            :key="url.name"
            :href="url.url"
            class="__url"
            @pointerdown.stop
            @pointerover="(ev) => onPointerOver(ev, url.name)"
            @pointerleave="onPointerLeave"
            target="_blank"
            draggable="false"
        >
            <img
                v-if="getIconPath(url.icon) !== undefined"
                :src="getIconPath(url.icon)"
                :alt="url.name"
                draggable="false"
            />
        </a>
    </div>
</template>

<script>
import { defineComponent, computed } from 'vue';

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
        tooltip: {
            required: false,
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

        /* eslint-disable vue/no-mutating-props,no-param-reassign */
        const onPointerOver = (ev, name) => {
            if (props.tooltip !== undefined) {
                props.tooltip.left = ev.clientX - ev.offsetX + ev.currentTarget.offsetWidth / 2;
                props.tooltip.top = ev.clientY - ev.offsetY + ev.currentTarget.offsetHeight;
                props.tooltip.text = name;
                props.tooltip.visible = true;
            }
        };

        const onPointerLeave = () => {
            if (props.tooltip !== undefined) {
                props.tooltip.visible = false;
            }
        };

        return {
            nodeIcon,
            padding,
            draggedClass,
            getIconPath,
            onPointerOver,
            onPointerLeave,
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
