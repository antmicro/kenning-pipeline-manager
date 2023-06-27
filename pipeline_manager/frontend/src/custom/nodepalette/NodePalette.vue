<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Custom node palette - Implements a sidebar containing available nodes.

Inherits from baklavajs/packages/renderer-vue/src/nodepalette/NodePalette.vue
-->

<template>
    <!-- eslint-disable vue/no-multiple-template-root -->
    <div class="baklava-node-palette">
        <div class="palette-title">
            <span>Nodes browser</span>
        </div>
        <PaletteCategory
            :nodeTree="nodeTree"
            :onDragStart="onDragStart"
            :defaultCollapse="collapse"
        />
    </div>
    <transition name="fade">
        <div v-if="draggedNode" class="baklava-dragged-node" :style="draggedNodeStyles">
            <PaletteEntry
                :title="draggedNode.nodeInformation.title"
                :iconPath="draggedNode.iconPath"
                :isDragged="true"
                :depth="0"
            />
        </div>
    </transition>
</template>

<script>
import { computed, defineComponent, inject, ref, reactive } from 'vue'; // eslint-disable-line object-curly-newline
import { useViewModel, useTransform } from 'baklavajs';
import { usePointer } from '@vueuse/core';
import PaletteCategory from './PaletteCategory.vue';
import getNodeTree from './nodeTree';
import PaletteEntry from './PaletteEntry.vue';

export default defineComponent({
    components: { PaletteCategory, PaletteEntry },
    setup() {
        const { viewModel } = useViewModel();

        const { x: mouseX, y: mouseY } = usePointer();
        const { transform } = useTransform();

        const editorEl = inject('editorEl');

        const draggedNode = ref(null);

        const draggedNodeStyles = computed(() => {
            if (!draggedNode.value || !editorEl?.value) {
                return {};
            }
            const { left, top } = editorEl.value.getBoundingClientRect();
            return {
                top: `${mouseY.value - top}px`,
                left: `${mouseX.value - left}px`,
            };
        });

        const onDragStart = (type, nodeInformation, iconPath) => {
            draggedNode.value = {
                type,
                nodeInformation,
                iconPath,
            };
            const onDragEnd = () => {
                const instance = reactive(new nodeInformation.type()); // eslint-disable-line new-cap,max-len
                viewModel.value.displayedGraph.addNode(instance);

                const rect = editorEl.value.getBoundingClientRect();
                const [x, y] = transform(mouseX.value - rect.left, mouseY.value - rect.top);
                instance.position.x = x;
                instance.position.y = y;

                draggedNode.value = null;
                document.removeEventListener('pointerup', onDragEnd);
            };
            document.addEventListener('pointerup', onDragEnd);
        };

        const nodeTree = computed(() => getNodeTree());
        const collapse = computed(() => viewModel.value.collapseSidebar);

        return {
            draggedNodeStyles,
            draggedNode,
            onDragStart,
            nodeTree,
            collapse,
        };
    },
});
</script>

<style lang="scss" scoped>
.palette-title {
    display: flex;
    align-items: center;
    margin: 0;
    border: 1px solid #393939;
    border-right: 0;
    border-top: 0;
    border-left: 0;

    padding-bottom: 1em;
    padding-top: 1em;
    padding-left: 2em;
}

span {
    color: $white;
    user-select: none;
}
</style>
