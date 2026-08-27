<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Component for generating forms based on generic template.
-->

<!-- eslint-disable vue/no-mutating-props -->
<template>
    <div class="create-menu">
        <div v-for="[option, label] in options" :key="option.id" class="option">
            <component
                :is="option.component"
                :intf="option"
                v-model="saveConfiguration[label]"
            />
        </div>
    </div>
</template>

<script>
import {
    defineComponent, computed, markRaw, toRef, ref,
} from 'vue';

import InputInterface from '../../interfaces/InputInterface.js';
import SelectInterface from '../../interfaces/SelectInterface.js';
import InputInterfaceComponent from '../../interfaces/InputInterface.vue';
import CheckboxInterface from '../../interfaces/CheckboxInterface.js';
import NumberInterface from '../../interfaces/NumberInterface.js';
import IntegerInterface from '../../interfaces/IntegerInterface.js';
import DynamicFormInterface from './DynamicForm.js';
import NestedFormInterface from './NestedForm.js';
import CustomMenusManager from '../../custom/CustomMenus.js';

export default defineComponent({
    props: {
        saveConfigurationTemplate: {
            required: true,
            type: Map,
        },
        saveConfiguration: {
            required: true,
            type: Object,
        },
    },
    setup(props) {
        const saveConfigurationTemplate = toRef(props, 'saveConfigurationTemplate');

        // Lets create dedicated component for it
        /* eslint-disable vue/no-mutating-props, max-len, no-param-reassign */
        const createNestedOption = (params, label) => {
            const { name, template } = params;
            if (!Object.hasOwn(props.saveConfiguration, label)) {
                props.saveConfiguration[label] = CustomMenusManager
                    .getDefaultValues(label, saveConfigurationTemplate.value);
            }
            return [computed(() =>
                new NestedFormInterface(
                    name,
                    label,
                    template,
                    props.saveConfiguration[label],
                )),
            label];
        };
        const createDynamicOption = (params, label) => {
            const { name, template } = params;
            const min = params?.min ?? 1;
            const max = params?.max ?? Number.MAX_SAFE_INTEGER;
            let value = min;

            if (!Object.hasOwn(props.saveConfiguration, label)) {
                const defaultValue = CustomMenusManager
                    .getDefaultValues(label, saveConfigurationTemplate.value);

                if (Array.isArray(defaultValue)) {
                    props.saveConfiguration[label] = defaultValue;
                    value = Math.max(props.saveConfiguration[label].length, min);
                } else {
                    value = defaultValue;
                    props.saveConfiguration[label] = [];
                }
            } else {
                value = props.saveConfiguration[label].length;
            }

            return [computed(() =>
                new DynamicFormInterface(
                    name,
                    template,
                    props.saveConfiguration[label],
                    value,
                    min,
                    max,
                )),
            label];
        };
        const createSelectOption = (params, label) => {
            const { name, items } = params;

            const selectItems = Object.entries(items).map(([key, value]) =>
                ({ text: key, value }),
            );

            if (!Object.hasOwn(props.saveConfiguration, label)) {
                props.saveConfiguration[label] = CustomMenusManager
                    .getDefaultValues(label, saveConfigurationTemplate.value);
            }

            return [computed(() => {
                const option = new SelectInterface(name,
                    props.saveConfiguration[label],
                    selectItems);
                option.events.setValue.subscribe(this, (v) => {
                    props.saveConfiguration[label] = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
                });
                option.setDefaultComponent();
                return option;
            }), label];
        };
        const createCheckboxOption = (params, label) => {
            const { name } = params;

            if (!Object.hasOwn(props.saveConfiguration, label) ||
                !(typeof props.saveConfiguration[label] === 'boolean')) {
                props.saveConfiguration[label] = CustomMenusManager
                    .getDefaultValues(label, saveConfigurationTemplate.value);
            }

            return [computed(() => {
                const option = new CheckboxInterface(name, props.saveConfiguration[label]);
                option.events.setValue.subscribe(this, (v) => {
                    props.saveConfiguration[label] = v; // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
                });
                option.setDefaultComponent();
                return option;
            }), label];
        };
        const generateNumericalOption = (params, label, floating) => {
            const { name } = params;
            const min = params?.min ?? Number.MIN_VALUE;
            const max = params?.max ?? Number.MAX_VALUE;

            if (!Object.hasOwn(props.saveConfiguration, label) ||
                Number.isNaN(Number.parseFloat(props.saveConfiguration[label]))
            ) {
                props.saveConfiguration[label] = CustomMenusManager
                    .getDefaultValues(label, saveConfigurationTemplate.value);
            }
            const NumericalType = floating ? NumberInterface : IntegerInterface;

            return [computed(() => {
                const option = new NumericalType(name, props.saveConfiguration[label], min, max);
                option.events.setValue.subscribe(this, (v) => {
                    props.saveConfiguration[label] = Math.max(Math.min(v, max), min); // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
                });
                option.setDefaultComponent();
                return option;
            }), label];
        };

        const createNumberOption = (params, label) => generateNumericalOption(params, label, true);
        const createIntOption = (params, label) => generateNumericalOption(params, label, false);

        const createInputOption = (params, label) => {
            const { name } = params;
            const createComponent = () => {
                const component = new InputInterface(name);
                component.componentName = 'InputInterface';
                if (!Object.hasOwn(props.saveConfiguration, label)) {
                    props.saveConfiguration[label] = CustomMenusManager
                        .getDefaultValues(label, saveConfigurationTemplate.value); // eslint-disable-line vue/no-mutating-props,max-len,no-param-reassign
                }
                component.setComponent(markRaw(InputInterfaceComponent));
                return component;
            };

            const option = ref(createComponent());

            return [option, label];
        };

        const typeToComponent = new Map(
            [
                ['text', createInputOption],
                ['number', createNumberOption],
                ['int', createIntOption],
                ['bool', createCheckboxOption],
                ['select', createSelectOption],
                ['dynamic', createDynamicOption],
                ['nested', createNestedOption],
            ],
        );

        const formOptions = computed(() => {
            const labels = [];
            Object.entries(saveConfigurationTemplate.value).forEach(([key, value]) => {
                const type = value?.type;

                if (type === undefined || !typeToComponent.has(type)) {
                    // nested form?
                    return;
                }
                const inputConstructor = typeToComponent.get(type);

                labels.push(
                    inputConstructor(value, key),
                );
            });
            return labels;
        });

        const options = computed(() => {
            const ret = [...formOptions.value]
                .filter(([option, _]) => option?.value !== undefined)
                .map(([option, label]) => [option.value, label]);
            return ret;
        });

        return { options };
    },
});
</script>
