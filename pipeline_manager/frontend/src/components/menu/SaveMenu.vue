<!--
Copyright (c) 2022-2024 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
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

        const readonly = computed(() => {
            if (props.saveConfiguration.readonly === undefined) return undefined;

            const option = new CheckboxInterface(
                'Make graph read only',
                props.saveConfiguration.readonly,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.saveConfiguration.readonly = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
            });
            return option;
        });

        const hideHud = computed(() => {
            if (props.saveConfiguration.hideHud === undefined) return undefined;

            const option = new CheckboxInterface(
                'Disable HUD',
                props.saveConfiguration.hideHud,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.saveConfiguration.hideHud = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
            });
            return option;
        });

        const position = computed(() => {
            if (props.saveConfiguration.position === undefined) return undefined;

            const option = new CheckboxInterface(
                'Preserve current view location',
                props.saveConfiguration.position,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.saveConfiguration.position = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
            });
            return option;
        });

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
            [readonly, hideHud, position].forEach((option) => {
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
