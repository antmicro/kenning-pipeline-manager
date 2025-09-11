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
import IntegerInterface from '../../../interfaces/IntegerInterface.js';
import newInputInterface from './utils.ts';

interface CurrentInterface {
    name: string,
    type: string,
    direction: Ref<string>,
    maxConnectionsCount: Ref<number>,
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
            maxConnectionsCount: ref(0),
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

        const interfaceConnectionCount = computed(() => {
            const option: any = new IntegerInterface(
                'Max connection count',
                newInterface.maxConnectionsCount.value,
                -1,
                100,
            ).setPort(false);

            option.events.setValue.subscribe(this, (v: number) => {
                newInterface.maxConnectionsCount.value = v;
            });

            option.componentName = 'IntegerInterface';
            return option as InterfaceInterface;
        });

        const addInterfaceMenu = computed(() => {
            const button: any = new ButtonInterface('Add interface', () => {
                if (newInterface.type === '') {
                    const intf = {
                        name: newInterface.name,
                        direction: newInterface.direction.value,
                        maxConnectionsCount: newInterface.maxConnectionsCount.value,
                    };
                    addInterface(intf);
                } else {
                    const typesList = newInterface.type.split(',');

                    const intf = {
                        name: newInterface.name,
                        type: typesList.length === 1 ? newInterface.type : typesList,
                        direction: newInterface.direction.value,
                        maxConnectionsCount: newInterface.maxConnectionsCount.value,
                    };
                    addInterface(intf);
                }
                close();
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        const configurationOptions = computed(
            () => [
                interfaceName.value,
                interfaceType.value,
                interfaceDirection.value,
                interfaceConnectionCount.value,
            ],
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
