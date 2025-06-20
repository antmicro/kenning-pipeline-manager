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
        </div>
        <div v-for="option in interfaceOptions" :key="option.id">
            <component :is="option.component" :intf="option" tabindex="-1"></component>
        </div>
        <component :is="removeInterface.component" :intf="removeInterface" />
    </div>
</template>

<script lang="ts">
import {
    defineComponent, computed, ref,
} from 'vue';
import { ButtonInterface } from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline
import CheckboxInterface from '../../../interfaces/CheckboxInterface.js';

import { removeInterfaces } from '../../../core/nodeCreation/Configuration.ts';
import { menuState, configurationState, InterfaceConfiguration } from '../../../core/nodeCreation/ConfigurationState.ts';

export default defineComponent({
    setup() {
        const close = () => {
            menuState.interfaceListMenu = false;
        };

        const items = configurationState.interfaces;
        const selectedItems = ref<InterfaceConfiguration[]>([]);

        function toggleItem(item: InterfaceConfiguration) {
            const i = selectedItems.value.indexOf(item);
            if (i >= 0) {
                selectedItems.value.splice(i, 1);
            } else {
                selectedItems.value.push(item);
            }
        }

        const interfaceOptions = computed(() => {
            const options: any = ref([]);

            items.forEach((item) => {
                const option = new CheckboxInterface(item.name, false);
                option.events.setValue.subscribe(this, () => toggleItem(item));
                options.value.push(option);
            });

            return options.value;
        });

        const removeInterface = computed(() => {
            const button: any = new ButtonInterface('Remove interfaces', () => {
                removeInterfaces(selectedItems.value);
                close();
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        return {
            items,
            selectedItems,
            removeInterface,
            interfaceOptions,
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
