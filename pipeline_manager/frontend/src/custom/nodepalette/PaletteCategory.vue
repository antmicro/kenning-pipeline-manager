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
    <div
        v-for="([name, category], i) in sortedEntries(nodeTree, true)"
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
                        <div class="__title-label" v-html="category.hitSubstring"></div>
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
                <div v-else class="__title" v-html="category.hitSubstring"></div>
            </div>
            <div v-show="mask[i]">
                <div v-if="category.nodes.nodeTypes">
                    <div
                        v-for="[nt, node] in sortedEntries(category.nodes.nodeTypes)"
                        style="width: 100%;"
                        v-show="node.mask"
                        :style="padding(depth + 1)"
                        :class="nodeEntryClasses(nt)"
                        :key="nt"
                    >
                        <div
                            @pointerdown="onDragStart(nt, node, node.iconPath)"
                            :class="nodeEntryClasses(nt)"
                        >
                            <template v-if="!isDefaultGraphNodeType(nt)">
                                <img
                                    class="__title-icon"
                                    v-if="node.iconPath !== undefined"
                                    :src="getIconPath(node.iconPath)"
                                    draggable="false"
                                />
                            </template>
                            <Cross v-else color="white" :rotate="45" class="__title-icon"></Cross>
                            <div class="__title-label" v-html="node.hitSubstring"></div>
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
                <PaletteCategory
                    :nodeTree="category.subcategories"
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
                    <div class="__title-label" v-html="category.hitSubstring"></div>
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
            <div v-else class="__title" v-html="category.hitSubstring"></div>
        </template>
    </div>
</template>

<script>
import { defineComponent, computed, ref, watch, inject } from 'vue'; // eslint-disable-line object-curly-newline
import { useViewModel } from '@baklavajs/renderer-vue';
import Arrow from '../../icons/Arrow.vue';
import VerticalEllipsis from '../../icons/VerticalEllipsis.vue';
import LinkMenu from '../LinkMenu.vue';
import EditorManager, { DEFAULT_GRAPH_NODE_TYPE } from '../../core/EditorManager';
import Cross from '../../icons/Cross.vue';

export default defineComponent({
    components: {
        Arrow, LinkMenu, VerticalEllipsis, Cross,
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
    setup(props) {
        const { viewModel } = useViewModel();
        const getIconPath = (name) => viewModel.value.cache[`./${name}`] ?? name;
        const isCategoryNode = (category) => category?.categoryNode !== undefined;

        const notEmptyCategory = (category) => {
            if (category.nodes.nodeTypes === undefined) {
                return Object.keys(category.subcategories).length !== 0;
            }
            return Object.keys(category.nodes.nodeTypes).length !== 0;
        };

        const paddingDepth = 30;
        const minPadding = 10;
        const padding = (depth, forceZero = false) => {
            if (forceZero) {
                return 'padding-left: 0';
            }
            return `padding-left: ${minPadding + depth * paddingDepth}px`;
        };

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

        const sortedEntries = (obj, sortSubcategories = false) =>
            Object.entries(obj).sort(([a, aNode], [b, bNode]) => {
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

        const showMenu = inject('menu');
        const showMenuClick = (menu) => {
            showMenu.value = (showMenu.value.hitSubstring === menu.hitSubstring) ? false : menu;
        };
        const closeMenu = () => {
            if (showMenu.value) showMenu.value = false;
        };

        const editorManager = EditorManager.getEditorManagerInstance();
        const specificationLoaded = computed(() => editorManager.specificationLoaded.value);

        const isDefaultGraphNodeType = (name) => name === DEFAULT_GRAPH_NODE_TYPE;

        const nodeEntryClasses = (name) => ({
            __entry: true,
            '__node-entry': true,
            '__default-graph-node-entry': isDefaultGraphNodeType(name),
        });

        return {
            padding,
            mask,
            onMouseDown,
            getRotation,
            sortedEntries,
            getIconPath,
            isCategoryNode,
            notEmptyCategory,
            showMenu,
            showMenuClick,
            closeMenu,
            specificationLoaded,
            nodeEntryClasses,
            isDefaultGraphNodeType,
        };
    },
});
</script>
