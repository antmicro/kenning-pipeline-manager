<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
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
                v-model="newProperty[option.configurationVModel as keyof CurrentProperty]"
                class="__name-option"
            />
            <component
                v-else
                :is="option.component"
                :intf="option"
                class="__name-option"
            />
        </div>
        <component :is="addProperty.component" :intf="addProperty" />
    </div>
</template>

<script lang="ts">
import {
    defineComponent, computed, markRaw, ref, Ref,
} from 'vue';
import {
    ButtonInterface,
    SelectInterface,
    IntegerInterface,
    CheckboxInterface,
} from '@baklavajs/renderer-vue'; // eslint-disable-line object-curly-newline

import { getOptionName } from '../../../custom/CustomNode.js';
import { customNodeConfiguration } from '../../../core/nodeCreation/Configuration.ts';
import { menuState } from '../../../core/nodeCreation/ConfigurationState.ts';

import InputInterface from '../../../interfaces/InputInterface.js';
import InputInterfaceComponent from '../../../interfaces/InputInterface.vue';

interface CurrentProperty {
    name: string,
    type: Ref<string>,
    default: string | Ref<number> | Ref<boolean>,
    min: Ref<number>
    max: Ref<number>
}

interface PropertyInterface extends InputInterface {
    componentName: string,
    configurationVModel?: keyof CurrentProperty
}

export default defineComponent({
    setup() {
        const newProperty: CurrentProperty = {
            name: 'New property',
            type: ref('text'),
            default: 'Default',
            min: ref(0),
            max: ref(0),
        };

        const enabledMinMax = ref(false);

        const close = () => {
            menuState.propertyMenu = false;
        };

        const propertyName = computed(() => {
            const option: any = new InputInterface(
                'Property name',
                newProperty.name,
            ).setPort(false);

            option.componentName = 'InputInterface';
            option.configurationVModel = 'name';
            option.setComponent(markRaw(InputInterfaceComponent));
            return option as PropertyInterface;
        });

        // NOTE: Select and List types are not supported for now
        const propertyType = computed(() => {
            const option: any = new SelectInterface(
                'Property type',
                newProperty.type.value,
                ['text', 'number', 'integer', 'bool', 'slider', 'constant', 'hex'],
            ).setPort(false);

            option.events.setValue.subscribe(this, (v: string) => {
                if (v === newProperty.type.value) return;

                if (['text', 'constant'].includes(v)) {
                    newProperty.default = v;
                } else if (['number', 'integer', 'slider', 'hex'].includes(v)) {
                    newProperty.default = ref(0);

                    // Whether to display min max values by default
                    if (['slider'].includes(v)) {
                        enabledMinMax.value = true;
                    } else {
                        enabledMinMax.value = false;
                    }
                } else if (['bool'].includes(v)) {
                    newProperty.default = ref(true);
                }

                newProperty.type.value = v;
            });

            option.componentName = 'SelectInterface';
            return option as PropertyInterface;
        });

        const propertyDefault = computed(() => {
            if (['text', 'constant'].includes(newProperty.type.value)) {
                const option: any = new InputInterface(
                    'Default value',
                    newProperty.default,
                ).setPort(false);

                option.componentName = 'InputInterface';
                option.configurationVModel = 'default';
                option.setComponent(markRaw(InputInterfaceComponent));
                return option as PropertyInterface;
            }

            if (['number', 'integer', 'slider', 'hex'].includes(newProperty.type.value)) {
                const option: any = new IntegerInterface(
                    'Default value',
                    (newProperty.default as Ref<number>).value,
                ).setPort(false);
                option.events.setValue.subscribe(this, (v: number) => {
                    (newProperty.default as Ref<number>).value = v;
                });
                option.componentName = 'IntegerInterface';
                return option as PropertyInterface;
            }

            const option: any = new CheckboxInterface(
                'Default value',
                (newProperty.default as Ref<boolean>).value,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v: boolean) => {
                (newProperty.default as Ref<boolean>).value = v;
            });
            option.componentName = 'CheckboxInterface';
            return option as PropertyInterface;
        });

        const addProperty = computed(() => {
            const button: any = new ButtonInterface('Add property', () => {
                const prop = {
                    name: newProperty.name,
                    type: newProperty.type.value,
                    default: (typeof newProperty.default === 'string') ? newProperty.default : newProperty.default.value,
                    min: enabledMinMax.value ? newProperty.min.value : undefined,
                    max: enabledMinMax.value ? newProperty.max.value : undefined,
                };

                customNodeConfiguration.addProperty(prop);
                close();
            });
            button.componentName = 'ButtonInterface';
            return button;
        });

        const useMinMax = computed(() => {
            const option: any = new CheckboxInterface(
                'Use min / max',
                enabledMinMax.value,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v: boolean) => {
                enabledMinMax.value = v;
            });
            option.componentName = 'CheckboxInterface';
            return option;
        });

        const propertyMin = computed(() => {
            const option: any = new IntegerInterface(
                'Min',
                newProperty.min.value ?? 0,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v: number) => {
                newProperty.min.value = v;
            });
            option.componentName = 'IntegerInterface';
            return option as PropertyInterface;
        });

        const propertyMax = computed(() => {
            const option: any = new IntegerInterface(
                'Max',
                newProperty.max.value ?? 1,
            ).setPort(false);
            option.events.setValue.subscribe(this, (v: number) => {
                newProperty.max.value = v;
            });
            option.componentName = 'IntegerInterface';
            return option as PropertyInterface;
        });

        const configurationOptions = computed(() => {
            let options = [propertyName.value, propertyType.value, propertyDefault.value];

            if (['number', 'integer', 'slider', 'hex'].includes(newProperty.type.value)) {
                if (!['slider'].includes(newProperty.type.value)) {
                    options.push(useMinMax.value);
                }

                if (enabledMinMax.value) {
                    options = options.concat([propertyMin.value, propertyMax.value]);
                }
            }

            return options;
        });

        return {
            configurationOptions,
            addProperty,
            customNodeConfiguration,
            getOptionName,
            newProperty,
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
