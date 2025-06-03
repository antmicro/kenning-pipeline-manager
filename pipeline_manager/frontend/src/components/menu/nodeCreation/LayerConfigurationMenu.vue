<!--
Copyright (c) 2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Popup menu for configuring node layer.
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
                v-model="newNodeData[
                    option.configurationVModel as keyof NodeDataConfiguration
                ]"
                class="__name-option"
            />
        </div>
        <component :is="setLayer.component" :intf="setLayer" />
    </div>
</template>

<script lang="ts">
import {
    defineComponent, computed, markRaw,
} from 'vue';
import { ButtonInterface } from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline

import { getOptionName } from '../../../custom/CustomNode.js';
import { customNodeConfiguration } from '../../../core/nodeCreation/Configuration.ts';
import { menuState, NodeDataConfiguration } from '../../../core/nodeCreation/ConfigurationState.ts';

import InputInterface from '../../../interfaces/InputInterface.js';
import InputInterfaceComponent from '../../../interfaces/InputInterface.vue';

interface NodeConfigurationInterface extends InputInterface {
    componentName: string,
    configurationVModel: keyof NodeDataConfiguration
}

export default defineComponent({
    setup() {
        const newNodeData = customNodeConfiguration.nodeData;

        const close = () => {
            menuState.layerMenu = false;
        };

        const nodeLayer = computed(() => {
            const option: any = new InputInterface(
                'Node layer',
                'Default layer',
            ).setPort(false);

            option.componentName = 'InputInterface';
            option.configurationVModel = 'layer';
            option.setComponent(markRaw(InputInterfaceComponent));
            return option as NodeConfigurationInterface;
        });

        const setLayer = computed(() => {
            const button: any = new ButtonInterface('Set layer', () => {
                customNodeConfiguration.modifyConfiguration(newNodeData);
                close();
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        const configurationOptions = computed(() =>
            [nodeLayer.value],
        );

        return {
            configurationOptions,
            getOptionName,
            newNodeData,
            setLayer,
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
