<!--
Copyright (c) 2022-2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Popup menu for choosing save options.
-->

<!-- eslint-disable vue/no-mutating-props -->
<template>
    <div class="save-menu">
        <component
            v-for="option in additionalOptions"
            :key="option.id"
            :is="option.component"
            :intf="option"
        />
        File name:
        <component
            :is="dataflowname.component"
            :intf="dataflowname" class="__name-option"
            v-model="saveConfiguration.saveName"
        />
        <component :is="save.component" :intf="save" />
    </div>
</template>

<script>
import { defineComponent, computed, markRaw } from 'vue';

import InputInterface from '../../interfaces/InputInterface.js';
import InputInterfaceComponent from '../../interfaces/InputInterface.vue';
import ButtonInterface from '../../interfaces/ButtonInterface.js';
import CheckboxInterface from '../../interfaces/CheckboxInterface.js';

export default defineComponent({
    props: {
        modelValue: {
            type: Boolean,
            default: false,
        },
        saveConfiguration: {
            required: true,
            type: Object,
        },
    },
    setup(props, { emit }) {
        const close = () => {
            if (props.modelValue) {
                emit('update:modelValue', false);
            }
        };

        const createOption = (text, label) => computed(() => {
            if (props.saveConfiguration[label] === undefined) return undefined;

            const option = new CheckboxInterface(text, props.saveConfiguration[label]);
            option.events.setValue.subscribe(this, (v) => {
                props.saveConfiguration[label] = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
            });
            return option;
        });

        const readonly = createOption('Make graph read only', 'readonly');
        const hideHud = createOption('Disable HUD', 'hideHud');
        const position = createOption('Preserve current view location', 'position');
        const graph = createOption('Save graph', 'graph');

        const dataflowname = computed(() => {
            const option = new InputInterface(
                'File name',
                'save',
            );
            option.componentName = 'InputInterface';
            option.setComponent(markRaw(InputInterfaceComponent));
            return option;
        });

        const save = computed(() => {
            const button = new ButtonInterface('Save', () => {
                props.saveConfiguration.saveCallback();
                close();
            });
            return button;
        });

        const additionalOptions = computed(() => {
            const displayableOptions = [];
            [readonly, hideHud, position, graph].forEach((option) => {
                if (option.value !== undefined) displayableOptions.push(option.value);
            });
            return displayableOptions;
        });

        return {
            additionalOptions,
            dataflowname,
            save,
        };
    },
});
</script>

<style lang="scss">
    .save-menu {
        display: flex;
        flex-direction: column;
        gap: 1em;

        height: max-content;

        .__name-option {
            & > .baklava-input {
                // Padding is included into width
                box-sizing: border-box;
            }
        }
    }
</style>
