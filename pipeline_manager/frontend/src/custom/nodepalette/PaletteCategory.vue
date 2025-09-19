<!--
Copyright (c) 2022-2024 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Component representing single node's type category/subcategory.
It groups the nodes of the same subcategory in the block that can be collapsed.
-->

<template v-if="specificationLoaded">
    <!-- eslint-disable vue/no-multiple-template-root -->
    <div v-show="nodeTree.mask">
        <div v-if="nodeTree.nodes.nodeTypes">
            <div
                v-for="[nt, node] in sortedEntries(nodeTree.nodes.nodeTypes)"
                style="width: 100%;"
                v-show="node.mask"
                :style="padding(depth)"
                :class="nodeEntryClasses(nt)"
                :key="nt"
            >
                <div
                    @pointerdown.left="onDragStart(nt, node, node.iconPath)"
                    @pointerdown.right="openContextMenu(nt)"
                    :class="nodeEntryClasses(nt)"
                >
                    <template v-if="!isTopLevelNode(nt)">
                        <img
                            class="__title-icon"
                            v-if="node.iconPath !== undefined"
                            :src="getIconPath(node.iconPath)"
                            draggable="false"
                        />
                    </template>
                    <Cross v-else color="white" :rotate="45" class="__title-icon"></Cross>
                    <div
                        class="__title-label"
                        v-html="DOMPurify.sanitize(prettyTitle(node.hitSubstring))"
                        :ref="el => labelRefs[nt] = el"
                    />
                </div>
                <div
                    class="__vertical_ellipsis"
                    ref="settings"
                    role="button"
                    @pointerdown.stop=""
                    @click.stop="() => showMenuClick(node)"
                    v-if="node.URLs.length !== 0"
                >
                    <VerticalEllipsis class="smaller_svg" />
                </div>
                <div class='__icondiv'>
                    <LinkMenu
                        :node='showMenu'
                        style='width: 18em'
                        v-if="showMenu !== false &&
                                showMenu.hitSubstring === node.hitSubstring"
                        v-click-outside="closeMenu"
                    />
                </div>
            </div>
        </div>
    </div>

    <CustomContextMenu
        v-if="showContextMenu"
        v-model="showContextMenu"
        :x="contextMenuX"
        :y="contextMenuY"
        :items="contextMenuItems"
        :style="contextMenuStyle"
        @click="onContextMenuClick"
        @pointerover="onPointerOver"
        @pointerleave="onPointerLeave"
    />

    <div
        v-for="([name, category], i) in sortedEntries(nodeTree.subcategories, true)"
        v-show="category.mask"
        :key="name"
    >
        <template v-if="notEmptyCategory(category)">
            <div
                class="__entry __category"
                @click="onMouseDown(i)"
                :style="padding(depth)"
            >
                <Arrow :rotate="getRotation(i)" scale="small" />
                <!-- There is only one category node -->
                <template v-if="isCategoryNode(category)">
                    <div
                        class="__entry __node-entry"
                        v-show="category.mask"
                        :key="category.title"
                        @click="onMouseDown(i)"
                        @pointerdown.left="onDragStart(
                            category.title,
                            category.categoryNode,
                            category.iconPath
                        )"
                        @pointerdown.right="openContextMenu(name)"
                    >
                        <img
                            class="__title-icon"
                            v-if="category.categoryNode.iconPath !== undefined"
                            :src="getIconPath(category.categoryNode.iconPath)"
                            draggable="false"
                        />
                        <div
                            class="__title-label"
                            v-html="DOMPurify.sanitize(prettyTitle(category.hitSubstring))"
                            :ref="el => labelRefs[name] = el">
                        </div>
                        <div
                            class="__vertical_ellipsis"
                            ref="settings"
                            role="button"
                            @pointerdown.stop=""
                            @click.stop="() => showMenuClick(category)"
                            v-if="category.categoryNode.URLs.length !== 0"
                        >
                            <VerticalEllipsis class="smaller_svg" />
                        </div>
                    </div>
                    <div class='__icondiv'>
                        <LinkMenu
                            :node='showMenu.categoryNode'
                            style='width: 18em'
                            v-if="showMenu !== false &&
                                  showMenu.hitSubstring === category.hitSubstring"
                            v-click-outside="closeMenu"
                        />
                    </div>
                </template>
                <div
                    v-else
                    class="__title"
                    v-html="DOMPurify.sanitize(prettyTitle(category.hitSubstring))"
                ></div>
            </div>
            <div v-show="mask[i]">
                <PaletteCategory
                    :nodeTree="category"
                    :onDragStart="onDragStart"
                    :depth="depth + 1"
                    :defaultCollapse="defaultCollapse"
                    :tooltip="tooltip"
                    :nodeSearch="nodeSearch"
                />
            </div>
        </template>
        <template v-else>
            <template v-if="isCategoryNode(category)">
                <div
                    :class="nodeEntryClasses(category.title)"
                    :style="padding(depth)"
                    v-show="category.mask"
                    :key="category.title"
                    @pointerdown="onDragStart(
                        category.title,
                        category.categoryNode,
                        category.iconPath
                    )"
                >
                    <img
                        class="__title-icon"
                        v-if="category.categoryNode.iconPath !== undefined"
                        :src="getIconPath(category.categoryNode.iconPath)"
                        draggable="false"
                    />
                    <div
                        class="__title-label"
                        v-html="DOMPurify.sanitize(category.hitSubstring)">
                    </div>
                    <div
                        class="__vertical_ellipsis"
                        ref="settings"
                        role="button"
                        @pointerdown.stop=""
                        @click.stop="() => showMenuClick(category)"
                        v-if="category.categoryNode.URLs.length !== 0"
                    >
                        <VerticalEllipsis class="smaller_svg" />
                    </div>
                    <div class='__icondiv'>
                        <LinkMenu
                            :node='showMenu.categoryNode'
                            style='width: 18em'
                            v-if="showMenu !== false &&
                                  showMenu.hitSubstring === category.hitSubstring"
                            v-click-outside="closeMenu"
                        />
                    </div>
                </div>
            </template>
            <div v-else class="__title">{{ prettyTitle(category.hitSubstring) }}</div>
        </template>
    </div>
</template>

<script>
import { defineComponent, computed, ref, watch, inject, reactive } from 'vue'; // eslint-disable-line object-curly-newline
import { useViewModel } from '@baklavajs/renderer-vue';
import DOMPurify from 'dompurify';
import Arrow from '../../icons/Arrow.vue';
import VerticalEllipsis from '../../icons/VerticalEllipsis.vue';
import LinkMenu from '../LinkMenu.vue';
import CustomContextMenu from '../ContextMenu.vue';
import EditorManager, { DEFAULT_CUSTOM_NODE_TYPE } from '../../core/EditorManager';
import Cross from '../../icons/Cross.vue';
import Bin from '../../icons/Bin.vue';
import { TOP_LEVEL_NODES_NAMES } from './nodeTree';

export default defineComponent({
    components: {
        Arrow, LinkMenu, VerticalEllipsis, Cross, CustomContextMenu,
    },
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
    data: () => ({
        DOMPurify,
    }),
    setup(props) {
        const { viewModel } = useViewModel();
        const getIconPath = (name) => viewModel.value.cache[`./${name}`] ?? name;
        const isCategoryNode = (category) => category?.categoryNode !== undefined;

        const notEmptyCategory = (category) =>
            Object.keys(category.nodes.nodeTypes ?? {}).length !== 0
            || Object.keys(category.subcategories).length !== 0;

        const paddingDepth = 30;
        const minPadding = 10;
        const padding = (depth, forceZero = false) => {
            if (forceZero) {
                return 'padding-left: 0';
            }
            return `padding-left: ${minPadding + depth * paddingDepth}px`;
        };

        const mask = ref(Array(
            Object.keys(props.nodeTree.subcategories ?? {}).length,
        ).fill(!props.defaultCollapse));
        let storedMask = mask.value;

        // If the category tree changes the mask needs to get reinitialized
        watch(
            () => props.nodeTree,
            () => {
                mask.value = Array(Object.keys(
                    props.nodeTree.subcategories ?? {},
                ).length).fill(!props.defaultCollapse);
            },
        );

        // If searching then the sidebar is expanded
        watch(
            () => props.nodeSearch,
            (newValue, oldValue) => {
                if (newValue !== '' && oldValue === '') {
                    storedMask = mask.value;
                    mask.value = Array(Object.keys(
                        props.nodeTree.subcategories ?? {},
                    ).length).fill(true);
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

        const isTopLevelNode = (name) => TOP_LEVEL_NODES_NAMES.includes(name);

        const sortedEntries = (obj, sortSubcategories = false) =>
            Object.entries(obj).sort(([a, aNode], [b, bNode]) => {
                if (a === DEFAULT_CUSTOM_NODE_TYPE) {
                    return -1;
                }
                if (b === DEFAULT_CUSTOM_NODE_TYPE) {
                    return 1;
                }
                if (!isTopLevelNode(a) && isTopLevelNode(b)) {
                    return 1;
                }
                if (isTopLevelNode(a) && !isTopLevelNode(b)) {
                    return -1;
                }

                if (sortSubcategories) {
                    if (notEmptyCategory(aNode) && !notEmptyCategory(bNode)) {
                        return 1;
                    }
                    if (!notEmptyCategory(aNode) && notEmptyCategory(bNode)) {
                        return -1;
                    }
                }

                return a.toLowerCase().localeCompare(b.toLowerCase());
            });
        const prettyTitle = (title) => title.replace('\\/', '/');

        const showMenu = inject('menu');
        const showMenuClick = (menu) => {
            showMenu.value = (showMenu.value.hitSubstring === menu.hitSubstring) ? false : menu;
        };
        const closeMenu = () => {
            if (showMenu.value) showMenu.value = false;
        };

        const editorManager = EditorManager.getEditorManagerInstance();
        const specificationLoaded = computed(() => editorManager.specificationLoaded.value);

        const nodeEntryClasses = (name) => ({
            __entry: true,
            '__node-entry': true,
            '__top-level-node-entry': isTopLevelNode(name),
        });

        const labelRefs = reactive({});
        const showContextMenu = ref(false);
        const contextMenuX = ref(0);
        const contextMenuY = ref(0);
        const selectedNode = ref('');

        const openContextMenu = (nodeType) => {
            if (
                showContextMenu.value === false &&
                !isTopLevelNode(nodeType) &&
                editorManager.baklavaView.settings.editableNodeTypes
            ) {
                selectedNode.value = nodeType;
                showContextMenu.value = true;

                const container = labelRefs[nodeType];
                const range = document.createRange();
                range.selectNodeContents(container);
                const rect = range.getBoundingClientRect();

                contextMenuX.value = rect.right + 20;
                contextMenuY.value = rect.top - 5.15 * rect.height;
            }
        };

        const contextMenuHoverInfo = reactive({
            isHovered: false,
            hoveredItemValue: undefined,
        });

        const onPointerOver = (value) => {
            contextMenuHoverInfo.hoveredItemValue = value;
            contextMenuHoverInfo.isHovered = true;
        };

        const onPointerLeave = (value) => {
            if (contextMenuHoverInfo.hoveredItemValue === value) {
                contextMenuHoverInfo.hoveredItemValue = undefined;
                contextMenuHoverInfo.isHovered = false;
            }
        };

        const contextMenuItems = computed(() => {
            const itemToDisable = () => !editorManager.editor.additionalNodeTypes.has(selectedNode.value); // eslint-disable-line max-len

            const items = [];
            items.push(
                {
                    value: 'delete',
                    label: 'Delete',
                    icon: Bin,
                    disabled: itemToDisable(),
                    onPointerEmit: itemToDisable(),
                    tooltipMsg: itemToDisable() && 'Node type can\'t be deleted',
                });
            return items;
        });

        const onContextMenuClick = () => {
            editorManager.removeNodeType(selectedNode.value);
        };

        return {
            padding,
            mask,
            onMouseDown,
            getRotation,
            sortedEntries,
            prettyTitle,
            getIconPath,
            isCategoryNode,
            notEmptyCategory,
            showMenu,
            showMenuClick,
            closeMenu,
            specificationLoaded,
            nodeEntryClasses,
            isTopLevelNode,
            openContextMenu,
            showContextMenu,
            contextMenuX,
            contextMenuY,
            contextMenuItems,
            onContextMenuClick,
            onPointerOver,
            onPointerLeave,
            labelRefs,
        };
    },
});
</script>
