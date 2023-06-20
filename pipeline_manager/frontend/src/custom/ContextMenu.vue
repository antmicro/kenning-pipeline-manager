<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Interface that is used to display inputs, outputs and properties of a node.

The custom implementations introduces wrapper functions that prevent the user
from creating and deleting connections or altering nodes' values if the editor is read-only.
-->

<template>
    <transition name="slide-fade">
        <div
            v-show="modelValue"
            ref="el"
            class="baklava-context-menu"
            :class="classes"
            :style="styles"
        >
            <template v-for="(item, index) in itemsWithHoverProperty">
                <div v-if="item.isDivider" :key="`d-${index}`" class="divider" />

                <div
                    v-else
                    :key="`i-${index}`"
                    class="item"
                    :class="{ submenu: !!item.submenu, '--disabled': !!item.disabled }"
                    @mouseenter="onMouseEnter($event, index)"
                    @mouseleave="onMouseLeave($event, index)"
                    @click.stop="onClick(item)"
                >
                    <template v-if="item.url === undefined">
                        <div class="icon">&nbsp;</div>
                        <div class="text">{{ item.label }}</div>
                    </template>
                    <template v-else>
                        <a
                            :key="item.name"
                            :href="item.url"
                            class="__url"
                            target="_blank"
                            draggable="false"
                        >
                            <div class="icon">
                                <img
                                    v-if="getIconPath(item.icon) !== undefined"
                                    :src="getIconPath(item.icon)"
                                    :alt="item.name"
                                    draggable="false"
                                />
                            </div>
                            <div class="text">{{ item.name }}</div>
                        </a>
                    </template>
                </div>
            </template>
        </div>
    </transition>
</template>

<script>
import { defineComponent } from 'vue';
import { Components } from 'baklavajs';

export default defineComponent({
    extends: Components.ContextMenu,
    props: {
        urls: {
            required: false,
            default: [],
        },
    },
    setup(props, context) {
        const getIconPath = (name) => (name !== undefined ? `./assets/${name}` : undefined);

        return { ...Components.ContextMenu.setup(props, context), getIconPath };
    },
});
</script>
