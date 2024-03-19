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
            <template v-if="itemsWithHoverProperty.length === 0">
                <div
                    class="readonly item"
                    style="cursor: default"
                >
                    <div class="text"><i>No resources</i></div>
                </div>
            </template>
            <template v-for="(item, index) in itemsWithHoverProperty">
                <div
                    v-if="item.url === undefined"
                    :key="`i-${index}`"
                    class="item"
                    :class="{ submenu: !!item.submenu, '--disabled': !!item.disabled }"
                    @click.stop="onClick(item)"
                >
                    <div class="icon">
                        <component v-if="item.icon !== undefined" :is="item.icon"></component>
                    </div>
                    <div class="text">{{ item.label }}</div>
                </div>
                <a
                    v-else
                    :key="item.name"
                    :href="item.url"
                    class="item"
                    target="_blank"
                    draggable="false"
                    @click.stop="onClick(item)"
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
                <hr v-if="item.endSection" :key="`hr-${index}`" />
            </template>
        </div>
    </transition>
</template>

<script>
import { defineComponent, ref } from 'vue';
import { Components, useViewModel } from '@baklavajs/renderer-vue';

export default defineComponent({
    extends: Components.ContextMenu,
    props: {
        urls: {
            required: false,
            default: [],
        },
    },
    emits: ['update:modelValue', 'click'],
    setup(props, context) {
        const {
            el,
            styles,
            classes,
            itemsWithHoverProperty,
        } = // eslint-disable-line object-curly-newline
            Components.ContextMenu.setup(props, context);

        const { viewModel } = useViewModel();
        const getIconPath = (name) => viewModel.value.cache[`./${name}`] ?? name;

        const justOpened = ref(true);

        const closeContextMenu = (ev) => {
            if (props.modelValue === true) {
                // We need a counter so that this event is not fired right when the menu is opened
                if (justOpened.value === false) {
                    const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
                    // We only need to fire closing event if the click was
                    // outside of the context menu. Otherwise `onClick` is fired.
                    if (!elements.includes(el.value)) {
                        window.removeEventListener('wheel', closeContextMenu);
                        window.removeEventListener('pointerdown', closeContextMenu);
                        context.emit('update:modelValue', false);
                    }
                    justOpened.value = true;
                } else {
                    justOpened.value = false;
                }
            }
        };

        window.addEventListener('wheel', closeContextMenu);
        window.addEventListener('pointerdown', closeContextMenu);

        const onClick = (item) => {
            context.emit('click', item.value);
            context.emit('update:modelValue', false);
        };

        return {
            el,
            styles,
            classes,
            itemsWithHoverProperty,
            onClick,
            getIconPath,
        };
    },
});
</script>
