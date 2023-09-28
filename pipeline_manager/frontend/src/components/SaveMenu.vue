<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!-- eslint-disable vue/no-mutating-props -->
<template>
    <div class="popup-menu">
        <div class="__header">
            <div class="__header-title">
                Save configuration
            </div>
            <Cross tabindex="-1" class="__close" @click="close" />
        </div>
        <component :is="readonly.component" :intf="readonly" />
        <component :is="hideHud.component" :intf="hideHud" />
        <component :is="position.component" :intf="position" />
        File name:
        <component
            :is="dataflowname.component"
            :intf="dataflowname" class="__name-option"
            v-model="saveConfiguration.savename"
        />
        <component :is="save.component" :intf="save" />
    </div>
</template>

<script>
import { defineComponent, computed, markRaw } from 'vue';
import {
    ButtonInterface,
    CheckboxInterface,
} from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline
import Cross from '../icons/Cross.vue';

import InputInterface from '../interfaces/InputInterface.js';
import InputInterfaceComponent from '../interfaces/InputInterface.vue';

export default defineComponent({
    props: {
        modelValue: {
            type: Boolean,
            default: false,
        },
        viewModel: {
            required: true,
            type: Object,
        },
        saveConfiguration: {
            required: true,
            type: Object,
        },
        saveCallback: {
            required: true,
            type: Function,
        },
    },
    components: {
        Cross,
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        const readonly = computed(() => {
            const option = new CheckboxInterface(
                'Make graph read only',
                props.saveConfiguration.readonly,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.saveConfiguration.readonly = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
            });
            option.componentName = 'CheckboxInterface';
            return option;
        });

        const hideHud = computed(() => {
            const option = new CheckboxInterface(
                'Disable HUD',
                props.saveConfiguration.hideHud,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.saveConfiguration.hideHud = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
            });
            option.componentName = 'CheckboxInterface';
            return option;
        });

        const position = computed(() => {
            const option = new CheckboxInterface(
                'Preserve current view location',
                props.saveConfiguration.position,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v) => {
                props.saveConfiguration.position = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
            });
            option.componentName = 'CheckboxInterface';
            return option;
        });

        const dataflowname = computed(() => {
            const option = new InputInterface(
                'File name',
                'save',
            ).setPort(false);

            option.componentName = 'InputInterface';
            option.setComponent(markRaw(InputInterfaceComponent));
            return option;
        });

        const close = () => {
            if (props.modelValue) {
                emit('update:modelValue', false);
            }
        };

        const save = computed(() => {
            const button = new ButtonInterface('Save', () => {
                props.saveCallback();
                close();
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        return {
            readonly,
            hideHud,
            position,
            dataflowname,
            save,
            close,
        };
    },
});
</script>

<style lang="scss">
    .popup-menu {
        position: absolute;
        background-color: #{$gray-600}E6;
        border: 1px solid $green;
        border-radius: 10px;
        color: white;
        user-select: none;

        left: 50vw;
        top: 50vh;
        transform: translate(-50%, -50%);
        padding: 1em;

        display: flex;
        flex-direction: column;
        gap: 1em;

        height: max-content;

        & > .__header {
            display: flex;
            align-items: center;

            & > .__header-title {
                font-size: $fs-small;
                flex-grow: 1;
            }

            & > .__close {
                flex-grow: 0;
                user-select: none;
                outline: none;
                cursor: pointer;
            }
        }

        & > .__name-option {
            & > .baklava-input {
                // Padding is included into width
                box-sizing: border-box;
            }
        }
    }
</style>
