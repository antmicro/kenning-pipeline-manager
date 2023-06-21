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
    <div v-for="(name, i) in Object.keys(nodeTree).sort(sortEntriesAlphabetically)" :key="name">
        <div class="__entry __category" :style="padding" @click="onMouseDown(i)">
            <Arrow :rotate="getRotation(i)" scale="small" />
            <div class="__title">
                {{ name }}
            </div>
        </div>
        <div v-show="mask[i]">
            <div v-if="nodeTree[name].nodes.nodeTypes">
                <PaletteEntry
                    v-for="nt in Object.keys(nodeTree[name].nodes.nodeTypes).sort(
                        sortEntriesAlphabetically,
                    )"
                    :key="nt"
                    :type="nt"
                    :title="nodeTree[name].nodes.nodeTypes[nt].title"
                    :iconPath="nodeTree[name].nodes.nodeIconPaths[nt]"
                    :urls="nodeTree[name].nodes.nodeURLs[nt]"
                    :depth="depth + 1"
                    @pointerdown="
                        onDragStart(
                            nt,
                            nodeTree[name].nodes.nodeTypes[nt],
                            nodeTree[name].nodes.nodeIconPaths[nt],
                        )
                    "
                />
            </div>
            <PaletteCategory
                :depth="depth + 1"
                :nodeTree="nodeTree[name].subcategories"
                :onDragStart="onDragStart"
                :defaultCollapse="defaultCollapse"
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

        const getRotation = (index) => {
            if (mask.value[index]) {
                return 'left';
            }
            return 'right';
        };

        const onMouseDown = (index) => {
            mask.value.splice(index, 1, !mask.value[index]);
        };

        const sortEntriesAlphabetically = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

        return {
            padding,
            mask,
            onMouseDown,
            getRotation,
            sortEntriesAlphabetically,
        };
    },
});
</script>

<style scoped>
.__category {
    cursor: pointer;
}
</style>
