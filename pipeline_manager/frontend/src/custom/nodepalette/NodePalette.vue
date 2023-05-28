<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Custom node palette - Implements a sidebar containing available nodes.

Inherits from baklavajs/packages/renderer-vue/src/nodepalette/NodePalette.vue
-->

<template>
    <div class="baklava-node-palette">
        <section v-for="c in categories" :key="c.name">
            <h1 v-if="c.name !== 'default'">
                {{ c.name }}
            </h1>
            <PaletteEntry
                v-for="(ni, nt, index) in c.nodeTypes"
                :key="nt"
                :type="nt"
                :title="ni.title"
                :iconPath="c.nodeIconPaths[index]"
                @pointerdown="onDragStart(nt, ni, c.nodeIconPaths[index])"
            />
        </section>
    </div>
    <!-- eslint-disable vue/no-multiple-template-root -->
    <transition name="fade">
        <div v-if="draggedNode" class="baklava-dragged-node" :style="draggedNodeStyles">
            <PaletteEntry
                :type="draggedNode.type"
                :title="draggedNode.nodeInformation.title"
                :iconPath="draggedNode.iconPath"
            />
        </div>
    </transition>
</template>

<script>
import { computed, defineComponent, inject, ref, reactive } from 'vue'; // eslint-disable-line object-curly-newline
import { usePointer } from '@vueuse/core';
import { useViewModel, useTransform } from 'baklavajs';
import PaletteEntry from './PaletteEntry.vue';
import checkRecursion from './checkRecursion';
import { SUBGRAPH_INPUT_NODE_TYPE, SUBGRAPH_OUTPUT_NODE_TYPE } from './subgraphInterface';

export default defineComponent({
    components: { PaletteEntry },
    setup() {
        const { viewModel } = useViewModel();
        const { editor } = viewModel.value;
        const { x: mouseX, y: mouseY } = usePointer();
        const { transform } = useTransform();

        const editorEl = inject('editorEl');

        const draggedNode = ref(null);
        const categories = computed(() => {
            const nodeTypeEntries = Array.from(editor.nodeTypes.entries());
            const categoryNames = new Set(nodeTypeEntries.map(([, ni]) => ni.category));

            const tempCategories = [];
            categoryNames.forEach((c) => {
                let nodeTypesInCategory = nodeTypeEntries.filter(([, ni]) => ni.category === c);
                if (viewModel.value.displayedGraph.template) {
                    // don't show the graph nodes that directly or indirectly contain
                    // the current subgraph to prevent recursion
                    nodeTypesInCategory = nodeTypesInCategory.filter(
                        ([nt]) => !checkRecursion(editor, viewModel.value.displayedGraph, nt),
                    );
                } else {
                    // if we are not in a subgraph, don't show subgraph input & output nodes
                    nodeTypesInCategory = nodeTypesInCategory.filter(
                        ([nt]) =>
                            ![SUBGRAPH_INPUT_NODE_TYPE, SUBGRAPH_OUTPUT_NODE_TYPE].includes(nt),
                    );
                }

                const nodesIconPath = nodeTypesInCategory.map((n) => {
                    const [nodeType] = n;
                    const iconPath = editor.getNodeIconPath(nodeType);
                    return iconPath;
                });

                if (nodeTypesInCategory.length > 0) {
                    tempCategories.push({
                        name: c,
                        nodeTypes: Object.fromEntries(nodeTypesInCategory),
                        nodeIconPaths: nodesIconPath,
                    });
                }
            });
            // sort, so the default category is always first and all
            // others are sorted alphabetically
            tempCategories.sort((a, b) => {
                if (a.name === 'default') {
                    return -1;
                }
                if (b.name === 'default') {
                    return 1;
                }
                return a.name > b.name ? 1 : -1;
            });

            return tempCategories;
        });

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

        return {
            draggedNode,
            categories,
            draggedNodeStyles,
            onDragStart,
            mouseX,
            mouseY,
        };
    },
});
</script>
