<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div :class="classes" :style="styles" v-show="value" v-click-outside="onClickOutside">
        <template v-for="(item, index) in parse_items()">
            <div v-if="item.isDivider" :key="index" class="divider"></div>

            <div
                v-else
                :key="index"
                :class="{ item: true, submenu: !!item.submenu, '--disabled': !!item.disabled }"
                @mouseenter="onMouseEnter($event, index)"
                @mouseleave="onMouseLeave($event, index)"
                @click.stop.prevent="onClick(item)"
                class="d-flex align-items-center"
            >
                <div class="flex-fill">{{ item.label }}</div>
                <div v-if="item.submenu" class="ml-3" style="line-height: 1em">
                    <svg width="13" height="13" viewBox="-60 120 250 250">
                        <path
                            d="
                            M160.875 279.5625 L70.875 369.5625 L70.875 189.5625 L160.875 279.5625 Z
                            "
                            stroke="none"
                            fill="white"
                        />
                    </svg>
                </div>
                <context-menu
                    v-if="item.submenu"
                    :value="activeMenu === index"
                    :items="item.submenu"
                    :is-nested="true"
                    :is-flipped="{ x: flippedX, y: flippedY }"
                    :flippable="flippable"
                    @click="onChildClick"
                ></context-menu>
            </div>
        </template>
    </div>
</template>

<script>
import { Components } from '@baklavajs/plugin-renderer-vue';

export default {
    extends: Components.ContextMenu,

    methods: {
        /**
         * Creates a two-element array based on argument item. First element is base category
         * label, second is submenu items that should be added as submenu items to the base
         * category item.
         *
         * @param child Context menu item as defined by BaklavaJS
         * @returns Two element array
         */
        parse_child(child) {
            const [label, ...remainingCategoriesArr] = child.label.split('/');
            const remainingCategories = remainingCategoriesArr.join('/');
            if (!remainingCategories) {
                return [label, child.submenu];
            }
            return [label, { ...child, label: remainingCategories }];
        },

        /**
         * Turns the original context menu item into a new one with a submenu containing only
         * leaves of original item and children representing base categories, with subcategories
         * splitted away down the tree.
         *
         * @param item Context menu item as defined by BaklavaJS
         * @returns New context menu item with subcategories splitted away
         */
        context_menu_dfs(item) {
            if (!item.submenu) {
                return item;
            }

            // Creates array containing [label, array of nodes to add to submenu]
            const categories = item.submenu
                .filter((child) => !!child.submenu && child.submenu.length > 0)
                .map(this.parse_child);

            // Merges nodes with the same label
            const m = new Map();
            categories.map((parsedChild) =>
                m.set(parsedChild[0], (m.get(parsedChild[0]) || []).concat(parsedChild[1])),
            );

            // Converts map to array of context menu items
            const submenu = Array.from(m)
                .map((category) => ({ label: category[0], submenu: category[1] }))
                .concat(
                    item.submenu.filter(
                        (child) => !child.submenu, // Add leaves
                    ),
                );

            return {
                ...item,
                submenu: submenu.map((i) => this.context_menu_dfs(i)),
            };
        },

        /**
         * Creates more advanced context menu, which allows for creation of multiple subcategories
         * in a tree structure.
         *
         * If a category name of the item is of the form
         * 'base_category/subcategory1/subcategory2...', this procedure will split those categories
         * and create a context submenu tree at this point.
         *
         * @returns Parsed context menu items
         */
        parse_items() {
            return this.items.map((i) => this.context_menu_dfs({ ...i, hover: false }));
        },
    },
};
</script>
