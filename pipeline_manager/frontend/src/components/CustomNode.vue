<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div :id="data.id" :class="classes" :style="styles">
        <div
            class="__title"
            @mousedown.self.stop="startDrag"
            @contextmenu.self.prevent="openContextMenu"
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
                    {{ getOptionName(option['optionComponent']) ? name : '' }}
                    <component
                        :is="plugin.components.nodeOption"
                        :key="name"
                        :name="name"
                        :option="option"
                        :componentName="option.optionComponent"
                        :node="data"
                        @openSidebar="openSidebar(name)"
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
                default:
                    return true;
            }
        },
        onContextMenu(action) {
            switch (action) {
                case 'delete':
                    this.plugin.editor.removeNode(this.data);
                    break;
                default:
                    break;
            }
        },
    },
};
</script>
