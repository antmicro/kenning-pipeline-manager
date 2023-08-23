<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Component representing single node's type category/subcategory.
It groups the nodes of the same subcategory in the block that can be collapsed.
-->

<template>
    <!-- eslint-disable vue/no-multiple-template-root -->
    <div
        v-for="([name, category], i) in sortedEntries(nodeTree)"
        v-show="category.mask"
        :key="name"
    >
        <div class="__entry __category" :style="padding(depth)" @click="onMouseDown(i)">
            <Arrow :rotate="getRotation(i)" scale="small" />
            <div class="__title" v-html="category.hitSubstring"></div>
        </div>
        <div v-show="mask[i]">
            <div v-if="category.nodes.nodeTypes">
                <div
                    v-for="[nt, node] in sortedEntries(category.nodes.nodeTypes)"
                    class="__entry __node-entry"
                    :style="padding(depth + 1)"
                    v-show="node.mask"
                    :key="nt"
                    @pointerdown="onDragStart(nt, node, category.nodes.nodeIconPaths[nt])"
                >
                    <img
                        class="__title-icon"
                        v-if="category.nodes.nodeIconPaths[nt] !== undefined"
                        :src="getIconPath(category.nodes.nodeIconPaths[nt])"
                        draggable="false"
                    />
                    <div class="__title-label" v-html="node.hitSubstring"></div>
                    <a
                        v-for="url in category.nodes.nodeURLs[nt]"
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
                            v-if="url.icon !== undefined"
                            :src="getIconPath(url.icon)"
                            :alt="url.name"
                            draggable="false"
                        />
                    </a>
                </div>
            </div>
            <PaletteCategory
                :nodeTree="category.subcategories"
                :onDragStart="onDragStart"
                :depth="depth + 1"
                :defaultCollapse="defaultCollapse"
                :tooltip="tooltip"
                :nodeSearch="nodeSearch"
            />
        </div>
    </div>
</template>

<script>
import { defineComponent, ref, watch } from 'vue'; // eslint-disable-line object-curly-newline
import { useViewModel } from '@baklavajs/renderer-vue';
import Arrow from '../../icons/Arrow.vue';

export default defineComponent({
    components: { Arrow },
    props: {
        nodeTree: {
            required: true,
        },
        onDragStart: {
            required: true,
        },
        depth: {
            type: Number,
            default: 0,
        },
        defaultCollapse: {
            type: Boolean,
            default: true,
        },
        tooltip: {
            required: false,
        },
        nodeSearch: {
            type: String,
            required: true,
        },
    },
    setup(props) {
        const { viewModel } = useViewModel();
        const getIconPath = (name) => viewModel.value.cache[`./${name}`] ?? name;

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

        const paddingDepth = 30;
        const minPadding = 10;
        const padding = (depth) => `padding-left: ${minPadding + depth * paddingDepth}px`;

        const mask = ref(Array(Object.keys(props.nodeTree).length).fill(!props.defaultCollapse));
        let storedMask = mask.value;

        // If the category tree changes the mask needs to get reinitialized
        watch(
            () => props.nodeTree,
            () => {
                mask.value = Array(Object.keys(props.nodeTree).length).fill(!props.defaultCollapse);
            },
        );

        // If searching then the sidebar is expanded
        watch(
            () => props.nodeSearch,
            (newValue, oldValue) => {
                if (newValue !== '' && oldValue === '') {
                    storedMask = mask.value;
                    mask.value = Array(Object.keys(props.nodeTree).length).fill(true);
                } else if (newValue === '' && oldValue !== '') {
                    mask.value = storedMask;
                }
            },
        );

        const getRotation = (index) => {
            if (mask.value[index]) {
                return 'left';
            }
            return 'right';
        };

        const onMouseDown = (index) => {
            mask.value.splice(index, 1, !mask.value[index]);
        };

        const sortedEntries = (obj) =>
            Object.entries(obj).sort(([a], [b]) =>
                a[0].toLowerCase().localeCompare(b[0].toLowerCase()),
            );

        return {
            padding,
            mask,
            onMouseDown,
            getRotation,
            sortedEntries,
            getIconPath,
            onPointerOver,
            onPointerLeave,
        };
    },
});
</script>
