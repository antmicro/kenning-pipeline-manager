<!--
Copyright (c) 2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Popup menu for configuring node data.
-->

<!-- eslint-disable vue/no-mutating-props -->
<template>
    <div class="create-menu">
        <div v-for="option in configurationOptions" :key="option.id">
            <div class="option-label">
                {{ getOptionName(option.componentName) ? `${option.name}:` : '' }}
            </div>
            <component
                :is="option.component"
                :intf="option"
                v-model="newNode[
                    option.configurationVModel as keyof NodeDataConfiguration
                ]"
                class="__name-option"
            />
        </div>
        <component :is="create.component" :intf="create" />
    </div>
</template>

<script lang="ts">
import { defineComponent, computed, markRaw } from 'vue';
import {
    ButtonInterface,
} from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline

import { getOptionName } from '../../../custom/CustomNode.js';
import { customNodeConfiguration } from '../../../core/nodeCreation/Configuration.ts';
import { menuState, NodeDataConfiguration, configurationState } from '../../../core/nodeCreation/ConfigurationState.ts';

import InputInterface from '../../../interfaces/InputInterface.js';
import TextAreaInterface from '../../../interfaces/TextAreaInterface.js';
import TextAreaInterfaceComponent from '../../../interfaces/TextAreaInterface.vue';
import newInputInterface from './utils.ts';

interface NodeConfigurationInterface extends InputInterface {
    componentName: string,
    configurationVModel: keyof NodeDataConfiguration
}

export default defineComponent({
    setup() {
        const newNode: NodeDataConfiguration = configurationState.nodeData;

        const close = () => {
            menuState.configurationMenu.visible = false;
        };

        const nodeName = newInputInterface<NodeConfigurationInterface>('Node name', 'Custom Node', 'name');
        const nodeCategory = newInputInterface<NodeConfigurationInterface>('Node category', 'Default', 'category');

        const nodeDescription = computed(() => {
            const option: any = new TextAreaInterface(
                'Node description',
                'Description',
            ).setPort(false);

            option.componentName = 'TextAreaInterface';
            option.configurationVModel = 'description';
            option.setComponent(markRaw(TextAreaInterfaceComponent));
            return option as NodeConfigurationInterface;
        });

        const create = computed(() => {
            let button: any;
            if (menuState.configurationMenu.addNode === true) {
                button = new ButtonInterface('Create', () => {
                    customNodeConfiguration.createNode(newNode);
                    close();
                });
            } else {
                button = new ButtonInterface('Configure', () => {
                    customNodeConfiguration.modifyConfiguration(newNode);
                    close();
                });
            }
            button.componentName = 'ButtonInterface';
            return button;
        });

        const configurationOptions = computed(() =>
            [nodeName.value, nodeCategory.value, nodeDescription.value],
        );

        return {
            configurationOptions,
            create,
            getOptionName,
            newNode,
        };
    },
});
</script>

<style lang="scss">
    .create-menu {
        display: flex;
        flex-direction: column;
        gap: 1em;

        height: max-content;

        & > div {
            & > .__name-option > .baklava-input {
                // Padding is included into width
                box-sizing: border-box;
            }

            & > .option-label {
                padding-bottom: $spacing-s;
                color: $white;
                font-size: $fs-medium;
            }
        }
    }
</style>
