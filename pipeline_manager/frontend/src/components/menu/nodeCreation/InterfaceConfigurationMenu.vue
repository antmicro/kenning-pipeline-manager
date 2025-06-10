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
        <component :is="addInterfaceMenu.component" :intf="addInterfaceMenu" />
    </div>
</template>

<script lang="ts">
import {
    defineComponent, computed, ref, Ref,
} from 'vue';
import {
    ButtonInterface,
    SelectInterface,
} from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline

import { getOptionName } from '../../../custom/CustomNode.js';
import { addInterface } from '../../../core/nodeCreation/Configuration.ts';
import { menuState } from '../../../core/nodeCreation/ConfigurationState.ts';

import InputInterface from '../../../interfaces/InputInterface.js';
import newInputInterface from './utils.ts';

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

        const interfaceName = newInputInterface<InterfaceInterface>('Interface name', newInterface.name, 'name');
        const interfaceType = newInputInterface<InterfaceInterface>('Interface type', newInterface.type, 'type');

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

        const addInterfaceMenu = computed(() => {
            const button: any = new ButtonInterface('Add interface', () => {
                if (newInterface.type === '') {
                    const intf = {
                        name: newInterface.name,
                        direction: newInterface.direction.value,
                    };
                    addInterface(intf);
                } else {
                    const typesList = newInterface.type.split(',');

                    const intf = {
                        name: newInterface.name,
                        type: typesList.length === 1 ? newInterface.type : typesList,
                        direction: newInterface.direction.value,
                    };
                    addInterface(intf);
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
            addInterfaceMenu,
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
