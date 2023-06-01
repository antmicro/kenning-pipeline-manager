<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <!-- eslint-disable vue/no-multiple-template-root -->
    <div v-for="(category, name, i) in nodeTree" :key="name">
        <div class="__entry __category" :style="padding" @click="onMouseDown(i)">
            <Arrow :rotate="getRotation(i)" scale="small" />
            <div class="__title">
                {{ name }}
            </div>
        </div>
        <div v-show="mask[i]">
            <PaletteEntry
                v-for="(ni, nt, j) in category.nodes.nodeTypes"
                :key="nt"
                :type="nt"
                :title="ni.title"
                :iconPath="category.nodes.nodeIconPaths[j]"
                :depth="depth + 1"
                @pointerdown="onDragStart(nt, ni, category.nodes.nodeIconPaths[j])"
            />
            <PaletteCategory
                :depth="depth + 1"
                :nodeTree="category.subcategories"
                :onDragStart="onDragStart"
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
    },
    setup(props) {
        const paddingDepth = 20;
        const minPadding = 10;
        const padding = computed(
            () => `padding-left: ${minPadding + props.depth * paddingDepth}px`,
        );

        const mask = ref(Array(Object.keys(props.nodeTree).length).fill(true));

        // If the category tree changes the mask needs to get reinitialized
        watch(
            () => props.nodeTree,
            () => {
                mask.value = Array(Object.keys(props.nodeTree).length).fill(true);
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

        return {
            padding,
            mask,
            onMouseDown,
            getRotation,
        };
    },
});
</script>

<style scoped>
.__category {
    cursor: pointer;
}
</style>
