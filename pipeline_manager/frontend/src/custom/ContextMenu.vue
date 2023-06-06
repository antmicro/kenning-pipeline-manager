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
        <div v-show="modelValue" ref="el" class="baklava-context-menu" :class="classes" :style="styles">
            <template v-for="(item, index) in itemsWithHoverProperty">
                <div v-if="item.isDivider" :key="`d-${index}`" class="divider" />

                <div
                    v-else
                    :key="`i-${index}`"
                    class="item"
                    :class="{ 'submenu': !!item.submenu, '--disabled': !!item.disabled }"
                    @mouseenter="onMouseEnter($event, index)"
                    @mouseleave="onMouseLeave($event, index)"
                >
                    <div class="flex-fill" v-if="item.url === undefined">
                        {{ item.label }}
                    </div>
                    <div class="flex-fill" v-else>
                        <a
                            :key="item.name"
                            :href="item.url"
                            class="__url"
                            target="_blank"
                        >
                            {{ item.name }}
                            <img
                                v-if="getIconPath(item.icon) !== undefined"
                                :src="getIconPath(item.icon)"
                                :alt="item.name"
                            />
                        </a>
                    </div>
                    <div v-if="item.submenu" class="__submenu-icon" style="line-height: 1em">
                        <svg width="13" height="13" viewBox="-60 120 250 250">
                            <path
                                d="M160.875 279.5625 L70.875 369.5625 L70.875 189.5625 L160.875 279.5625 Z"
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
                    />
                </div>
            </template>
        </div>
    </transition>
</template>

<script>
import { defineComponent } from 'vue';
import {
    Components,
} from 'baklavajs';

export default defineComponent({
    extends: Components.ContextMenu,
    props: {
        urls: {
            required: false,
            default: []
        },
    },
    setup(props, context) {
        const urls = props.urls;
        const getIconPath = (name) => (name !== undefined ? `./assets/${name}` : undefined);

        return { ...Components.ContextMenu.setup(props, context), urls, getIconPath };
    },
});
</script>
