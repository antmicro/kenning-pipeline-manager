<!--
Copyright (c) 2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Popup menu for configuring node properties.
-->

<!-- eslint-disable vue/no-mutating-props -->
<template>
    <div class="create-menu">
        <div v-for="option in configurationOptions" :key="option.id">
            <div class="option-label">
                {{ getOptionName(option.componentName) ? `${option.name}:` : '' }}
            </div>
        </div>
        <div v-for="option in propertyOptions" :key="option.id">
            <component :is="option.component" :intf="option" tabindex="-1"></component>
        </div>
        <component :is="removeProperty.component" :intf="removeProperty" />
    </div>
</template>

<script lang="ts">
import {
    defineComponent, computed, ref,
} from 'vue';
import { ButtonInterface } from '@baklavajs/renderer-vue';
import CheckboxInterface from '../../../interfaces/CheckboxInterface.js';

import { removeProperties } from '../../../core/nodeCreation/Configuration.ts';
import { menuState, configurationState, PropertyConfiguration } from '../../../core/nodeCreation/ConfigurationState.ts';

export default defineComponent({
    setup() {
        const close = () => {
            menuState.propertyListMenu = false;
        };

        const items = configurationState.properties;
        const selectedItems = ref<PropertyConfiguration[]>([]);

        function toggleItem(item: PropertyConfiguration) {
            const i = selectedItems.value.indexOf(item);
            if (i >= 0) {
                selectedItems.value.splice(i, 1);
            } else {
                selectedItems.value.push(item);
            }
        }

        const propertyOptions = computed(() => {
            const options: any = ref([]);

            items.forEach((item) => {
                const option = new CheckboxInterface(item.name, false);
                option.events.setValue.subscribe(this, () => toggleItem(item));
                options.value.push(option);
            });

            return options.value;
        });

        const removeProperty = computed(() => {
            const button: any = new ButtonInterface('Remove properties', () => {
                removeProperties(selectedItems.value);
                close();
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        return {
            items,
            selectedItems,
            removeProperty,
            propertyOptions,
        };
    },
});
</script>
