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
        v-for="([name, category], i) in Object.entries(nodeTree)"
        :key="name"
        v-show="category.mask"
    >
        <div class="__entry __category" :style="padding" @click="onMouseDown(i)">
            <Arrow :rotate="getRotation(i)" scale="small" />
            {{ forceShow }}
            <div class="__title" v-html="highlightText(name)">
            </div>
        </div>
        <!-- Alternatively we could use v-show which has a higher overhead on startup,
        but it prepares the whole tree structure so it does not need to be reinitialized
        every time it is toggled -->
        <div v-show="forceShow || mask[i]">
            <div v-if="category.nodes.nodeTypes">
                <PaletteEntry
                    v-for="[nt, node] in Object.entries(category.nodes.nodeTypes)"
                    v-show="node.mask"
                    :key="nt"
                    :type="nt"
                    :title="highlightText(node.title)"
                    :iconPath="category.nodes.nodeIconPaths[nt]"
                    :urls="category.nodes.nodeURLs[nt]"
                    :depth="depth + 1"
                    :tooltip="tooltip"
                    @pointerdown="
                        onDragStart(
                            nt,
                            node,
                            category.nodes.nodeIconPaths[nt],
                        )
                    "
                />
            </div>
            <PaletteCategory
                :depth="depth + 1"
                :nodeTree="category.subcategories"
                :onDragStart="onDragStart"
                :defaultCollapse="defaultCollapse"
                :tooltip="tooltip"
                :nodeSearch="nodeSearch"
            />
        </div>
    </div>
</template>

<script>
import { defineComponent, computed, ref, watch } from 'vue'; // eslint-disable-line object-curly-newline
import PaletteEntry from './PaletteEntry.vue';
import Arrow from '../../icons/Arrow.vue';

export default defineComponent({
    components: { PaletteEntry, Arrow },
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
            default: ''
        },
    },
    setup(props) {
        const paddingDepth = 20;
        const minPadding = 10;
        const padding = computed(
            () => `padding-left: ${minPadding + props.depth * paddingDepth}px`,
        );

        const mask = ref(Array(Object.keys(props.nodeTree).length).fill(!props.defaultCollapse));

        // If the category tree changes the mask needs to get reinitialized
        watch(
            () => props.nodeTree,
            () => {
                mask.value = Array(Object.keys(props.nodeTree).length).fill(!props.defaultCollapse);
            },
        );

        const forceShow = computed(() => props.nodeSearch !== '');

        const getRotation = (index) => {
            if (mask.value[index]) {
                return 'left';
            }
            return 'right';
        };

        const onMouseDown = (index) => {
            mask.value.splice(index, 1, !mask.value[index]);
        };

        const sortEntriesAlphabetically = (a, b) => {
            a[0].toLowerCase().localeCompare(b[0].toLowerCase())
        };

        const highlightText = (name) => {
            const substring = props.nodeSearch.toLowerCase();
            const idx = name.toLowerCase().indexOf(substring);

            if (idx === -1) {
                return name;
            }

            return name.substring(0, idx) +
                '<span>' + name.substring(idx, idx + substring.length) + '</span>' +
                name.substring(idx + substring.length);            
        }

        return {
            padding,
            mask,
            onMouseDown,
            getRotation,
            sortEntriesAlphabetically,
            highlightText,
            forceShow,
        };
    },
});
</script>
