<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div :id="data.id" :class="classes" :style="styles">
        <div
            class="__title"
            @mousedown.self.stop="startDragWrapper"
            @contextmenu.self.prevent="openContextMenuWrapper"
        >
            <span>{{ data.name }}</span>

            <component
                :is="plugin.components.contextMenu"
                v-model="contextMenu.show"
                :x="contextMenu.x"
                :y="contextMenu.y"
                :items="contextMenu.items"
                @click="onContextMenu"
            ></component>
        </div>

        <div class="__content">
            <!-- Outputs -->
            <div class="__outputs">
                <component
                    :is="plugin.components.nodeInterface"
                    v-for="(output, name) in data.outputInterfaces"
                    :key="output.id"
                    :name="name"
                    :data="output"
                ></component>
            </div>

            <!-- Options -->
            <div class="__options">
                <template v-for="[name, option] in data.options">
                    {{ getOptionName(option['optionComponent']) ? `${name}:` : '' }}
                    <component
                        :is="plugin.components.nodeOption"
                        :key="name"
                        :name="name"
                        :option="option"
                        :componentName="option.optionComponent"
                        :node="data"
                    ></component>
                </template>
            </div>

            <!-- Inputs -->
            <div class="__inputs">
                <component
                    :is="plugin.components.nodeInterface"
                    v-for="(input, name) in data.inputInterfaces"
                    :key="input.id"
                    :name="name"
                    :data="input"
                ></component>
            </div>
        </div>
    </div>
</template>

<script>
import { Components } from '@baklavajs/plugin-renderer-vue';

export default {
    // CustomNode inherits from the original baklavajs Node
    extends: Components.Node,
    data() {
        return {
            contextMenu: {
                show: false,
                x: 0,
                y: 0,
                items: [{ value: 'delete', label: 'Delete' }],
            },
        };
    },
    methods: {
        /**
         * The function decides whether a name for the option should be displayed.
         *
         * @param optionType Name of the option component
         * @returns True if the name should be displayed, false otherwise.
         */
        getOptionName(optionType) {
            switch (optionType) {
                case 'NumberOption':
                case 'IntegerOption':
                case 'CheckboxOption':
                case 'SliderOption':
                    return false;
                case 'InputOption':
                case 'SelectOption':
                case 'ListOption':
                case 'TextOption':
                default:
                    return true;
            }
        },
        /**
         * Executes chosen action in the context menu based on its name.
         *
         * @param action Action chosen in the context menu
         */
        onContextMenu(action) {
            switch (action) {
                case 'delete':
                    this.plugin.editor.removeNode(this.data);
                    break;
                default:
                    break;
            }
        },
        /**
         * Wrapper that prevents node moving if the editor is in read-only mode.
         *
         * @param ev Event
         */
        startDragWrapper(ev) {
            if (!this.plugin.editor.readonly) {
                this.startDrag(ev);
            }
        },
        /**
         * Wrapper that prevents opening the context menu if the editor is in read-only mode.
         *
         * @param ev Event
         */
        openContextMenuWrapper(ev) {
            if (!this.plugin.editor.readonly) {
                this.openContextMenu(ev);
            }
        },
    },
};
</script>
