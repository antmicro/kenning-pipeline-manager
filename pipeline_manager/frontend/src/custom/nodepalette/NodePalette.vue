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
        class="baklava-node-palette export-hidden"
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
import { computed, defineComponent, provide, inject, ref, onMounted, watch } from 'vue'; // eslint-disable-line object-curly-newline
import { useViewModel, useTransform } from '@baklavajs/renderer-vue';
import { usePointer } from '@vueuse/core';
import PaletteCategory from './PaletteCategory.vue';
import getNodeTree from './nodeTree';
import PaletteEntry from './PaletteEntry.vue';
import Tooltip from '../../components/Tooltip.vue';
import Magnifier from '../../icons/Magnifier.vue';
import { DEFAULT_CUSTOM_NODE_TYPE } from '../../core/EditorManager';
import { menuState, configurationState } from '../../core/nodeCreation/ConfigurationState';

export default defineComponent({
    components: {
        PaletteCategory,
        PaletteEntry,
        Tooltip,
        Magnifier,
    },
    setup() {
        const { viewModel } = useViewModel();
        const { editor } = viewModel.value;

        const { x: mouseX, y: mouseY } = usePointer();
        const { transform } = useTransform();

        const paletteRef = ref(null);
        const editorEl = inject('editorEl');

        const draggedNode = ref(null);
        const tooltip = ref(null);

        const x = ref(null);
        const y = ref(null);

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

        function placeNode(instance) {
            viewModel.value.displayedGraph.addNode(instance);
            instance.position.x = x.value; // eslint-disable-line no-param-reassign
            instance.position.y = y.value; // eslint-disable-line no-param-reassign
        }

        // Add new node when configuration menu is closed
        watch(() => menuState.configurationMenu.visible, async (newValue, oldValue) => {
            if (oldValue === true && newValue === false) {
                const newType = configurationState.nodeData.name;
                const nodeInformation = editor.nodeTypes.get(newType);
                const instance = new nodeInformation.type(); // eslint-disable-line new-cap
                if (menuState.configurationMenu.addNode && configurationState.success) {
                    placeNode(instance);
                }
            }
        });

        const dragEndPlaceNode = (ev) => {
            const elements = document.elementsFromPoint(ev.clientX, ev.clientY);

            if (!elements.includes(paletteRef.value)) {
                const rect = editorEl.value.getBoundingClientRect();
                [x.value, y.value] = transform(mouseX.value - rect.left, mouseY.value - rect.top);

                if (draggedNode.value.type === DEFAULT_CUSTOM_NODE_TYPE) {
                    menuState.configurationMenu.visible = !menuState.configurationMenu.visible;
                    menuState.configurationMenu.addNode = true;
                } else {
                    const instance = new draggedNode.value.nodeInformation.type(); // eslint-disable-line new-cap,max-len
                    placeNode(instance);
                }

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
