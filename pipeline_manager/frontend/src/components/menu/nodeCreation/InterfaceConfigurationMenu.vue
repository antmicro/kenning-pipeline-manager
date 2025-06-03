<!--
Copyright (c) 2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Popup menu for configuring node interfaces.
-->

<!-- eslint-disable vue/no-mutating-props -->
<template>
    <div class="create-menu">
        <div v-for="option in configurationOptions" :key="option.id">
            <div class="option-label">
                {{ getOptionName(option.componentName) ? `${option.name}:` : '' }}
            </div>
            <component
                v-if="option.componentName === 'InputInterface'"
                :is="option.component"
                :intf="option"
                v-model="newInterface[option.configurationVModel as keyof CurrentInterface]"
                class="__name-option"
            />
            <component
                v-else
                :is="option.component"
                :intf="option"
                class="__name-option"
            />
        </div>
        <component :is="addInterface.component" :intf="addInterface" />
    </div>
</template>

<script lang="ts">
import {
    defineComponent, computed, markRaw, ref, Ref,
} from 'vue';
import {
    ButtonInterface,
    SelectInterface,
} from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline

import { getOptionName } from '../../../custom/CustomNode.js';
import { customNodeConfiguration } from '../../../core/nodeCreation/Configuration.ts';
import { menuState } from '../../../core/nodeCreation/ConfigurationState.ts';

import InputInterface from '../../../interfaces/InputInterface.js';
import InputInterfaceComponent from '../../../interfaces/InputInterface.vue';

interface CurrentInterface {
    name: string,
    type: string,
    direction: Ref<string>,
}

interface InterfaceInterface extends InputInterface {
    componentName: string,
    configurationVModel?: keyof CurrentInterface
}

export default defineComponent({
    setup() {
        const newInterface: CurrentInterface = {
            name: 'New interface',
            type: '',
            direction: ref('inout'),
        };

        const close = () => {
            menuState.interfaceMenu = false;
        };

        const interfaceName = computed(() => {
            const option: any = new InputInterface(
                'Interface name',
                newInterface.name,
            ).setPort(false);

            option.componentName = 'InputInterface';
            option.configurationVModel = 'name';
            option.setComponent(markRaw(InputInterfaceComponent));
            return option as InterfaceInterface;
        });

        const interfaceType = computed(() => {
            const option: any = new InputInterface(
                'Interface type',
                newInterface.type,
            ).setPort(false);

            option.componentName = 'InputInterface';
            option.configurationVModel = 'type';
            option.setComponent(markRaw(InputInterfaceComponent));
            return option as InterfaceInterface;
        });

        const interfaceDirection = computed(() => {
            const option: any = new SelectInterface(
                'Interface direction',
                newInterface.direction.value,
                ['input', 'output', 'inout'],
            ).setPort(false);

            option.events.setValue.subscribe(this, (v: string) => {
                newInterface.direction.value = v;
            });

            option.componentName = 'SelectInterface';
            return option as InterfaceInterface;
        });

        const addInterface = computed(() => {
            const button: any = new ButtonInterface('Add interface', () => {
                if (newInterface.type === '') {
                    const intf = {
                        name: newInterface.name,
                        direction: newInterface.direction.value,
                    };
                    customNodeConfiguration.addInterface(intf);
                } else {
                    const typesList = newInterface.type.split(',');

                    const intf = {
                        name: newInterface.name,
                        type: typesList.length === 1 ? newInterface.type : typesList,
                        direction: newInterface.direction.value,
                    };
                    customNodeConfiguration.addInterface(intf);
                }
                close();
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        const configurationOptions = computed(
            () => [interfaceName.value, interfaceType.value, interfaceDirection.value],
        );

        return {
            configurationOptions,
            addInterface,
            customNodeConfiguration,
            getOptionName,
            newInterface,
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
../../../core/nodeCreation/Configuration.ts../../../core/nodeCreation/ConfigurationState.ts
