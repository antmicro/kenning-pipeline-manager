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
    <div
        ref="paletteRef"
        class="baklava-node-palette"
        :class="{'hidden-navbar': $isMobile}"
    >
        <div class="search-bar">
            <div class="palette-title">
                <span>Nodes browser</span>
            </div>
            <div class="__entry_search">
                <Magnifier :color="'gray'" />
                <input class="node-search" v-model="nodeSearch" placeholder="Search" />
            </div>
        </div>
        <div class="nodes">
            <PaletteCategory
                :nodeTree="nodeTree"
                :onDragStart="onDragStart"
                :defaultCollapse="collapse"
                :tooltip="tooltip"
                :nodeSearch="nodeSearch"
            />
        </div>
        <!-- Height of the sidebar is 60 so we need to subtract that -->
        <Tooltip
            v-show="tooltip.visible"
            :text="tooltip.text"
            :left="tooltip.left"
            :top="tooltip.top - 60"
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
import { computed, defineComponent, provide, inject, ref, onMounted } from 'vue'; // eslint-disable-line object-curly-newline
import { useViewModel, useTransform } from '@baklavajs/renderer-vue';
import { usePointer } from '@vueuse/core';
import PaletteCategory from './PaletteCategory.vue';
import getNodeTree from './nodeTree';
import PaletteEntry from './PaletteEntry.vue';
import Tooltip from '../../components/Tooltip.vue';
import Magnifier from '../../icons/Magnifier.vue';

export default defineComponent({
    components: {
        PaletteCategory,
        PaletteEntry,
        Tooltip,
        Magnifier,
    },
    setup() {
        const { viewModel } = useViewModel();

        const { x: mouseX, y: mouseY } = usePointer();
        const { transform } = useTransform();

        const paletteRef = ref(null);
        const editorEl = inject('editorEl');

        const draggedNode = ref(null);
        const tooltip = ref(null);

        tooltip.value = {
            top: 0,
            left: 0,
            visible: false,
            text: '',
        };

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

        const dragEndPlaceNode = (ev) => {
            const elements = document.elementsFromPoint(ev.clientX, ev.clientY);

            if (!elements.includes(paletteRef.value)) {
                const instance = new draggedNode.value.nodeInformation.type(); // eslint-disable-line new-cap,max-len
                viewModel.value.displayedGraph.addNode(instance);

                const rect = editorEl.value.getBoundingClientRect();
                const [x, y] = transform(mouseX.value - rect.left, mouseY.value - rect.top);
                instance.position.x = x;
                instance.position.y = y;

                draggedNode.value = null;
                document.removeEventListener('pointerup', dragEndPlaceNode);
                document.removeEventListener('keydown', dragEndDeselectNode); // eslint-disable-line no-use-before-define
            }
        };

        const dragEndDeselectNode = (ev) => {
            if (ev.key === 'Escape') {
                draggedNode.value = null;

                document.removeEventListener('pointerup', dragEndPlaceNode);
                document.removeEventListener('keydown', dragEndDeselectNode);
            }
        };

        const onDragStart = (type, nodeInformation, iconPath) => {
            draggedNode.value = {
                type,
                nodeInformation,
                iconPath,
            };

            document.addEventListener('pointerup', dragEndPlaceNode);
            document.addEventListener('keydown', dragEndDeselectNode);
        };
        const nodeSearch = ref('');
        const scroll = ref(0);
        const showMenu = ref(false);
        provide('menu', showMenu);

        const nodeTree = computed(() => getNodeTree(nodeSearch));
        const collapse = computed(() => viewModel.value.collapseSidebar);

        onMounted(() => {
            const nodesContainer = computed(() => document.querySelector('.nodes'));
            nodesContainer.value.addEventListener('scroll', (event) => {
                scroll.value = event.target.scrollTop;
                const iconMenus = document.getElementsByClassName('__icondiv');
                for (let i = 0; i < iconMenus.length; i += 1) {
                    iconMenus[i].style.translate = `0px -${scroll.value.toString()}px`;
                }
            });
        });

        return {
            draggedNodeStyles,
            draggedNode,
            onDragStart,
            nodeTree,
            collapse,
            tooltip,
            nodeSearch,
            paletteRef,
            scroll,
        };
    },
});
</script>
