<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
A single entry representing available node type in the sidebar.
-->
<template>
    <div class="__entry __node-entry __dragged" :style="padding">
        <img class="__title-icon" v-if="nodeIcon !== undefined" :src="nodeIcon" draggable="false" />
        <div class="__title-label" v-html="title"></div>
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
    },
    setup(props) {
        const getIconPath = (name) => (name !== undefined ? `./assets/${name}` : undefined);

        const nodeIcon = computed(() => getIconPath(props.iconPath));
        const paddingDepth = 20;
        const minPadding = 10;
        const padding = computed(
            () => `padding-left: ${minPadding + props.depth * paddingDepth}px`,
        );

        return {
            nodeIcon,
            padding,
            getIconPath,
        };
    },
});
</script>

<style lang="scss" scoped>
.__dragged {
    border-radius: var(--baklava-node-border-radius);
    border-width: 0px;
}
</style>
