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
        <div v-for="(item, index) in items" :key="index">
            <label>
                <input type="checkbox" v-model="selectedItems" :value="item" />
                {{ item.name }}
            </label>
        </div>
        <component :is="removeInterface.component" :intf="removeInterface" />
    </div>
</template>

<script lang="ts">
import {
    defineComponent, computed, ref,
} from 'vue';
import { ButtonInterface } from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline

import { removeInterfaces } from '../../../core/nodeCreation/Configuration.ts';
import { menuState, configurationState } from '../../../core/nodeCreation/ConfigurationState.ts';

export default defineComponent({
    setup() {
        const close = () => {
            menuState.interfaceListMenu = false;
        };

        const items = configurationState.interfaces;
        const selectedItems = ref([]);

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
