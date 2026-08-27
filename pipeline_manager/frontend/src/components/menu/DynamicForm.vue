<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Component for generating dynamic form.
-->

<!-- eslint-disable vue/no-mutating-props -->
 <!-- eslint-disable no-param-reassign -->
<template>
    <div class="create-menu">
        <div>{{intf.name}}:</div>
        <div class="dynamic-list">
            <div class="dynamic-list-view">
                <div v-for="([name,template], index) in dynamicTemplates"
                    :key="name" class="dynamic-element">
                    <div>{{name}}:</div>
                    <component
                        :is="CustomForm"
                        :saveConfigurationTemplate="template"
                        :saveConfiguration="config[index]"
                    />
                </div>
            </div>
            <component
                :is="amountOfProp.component"
                :intf="amountOfProp"
            />
        </div>
    </div>
</template>

<script>
import {
    defineComponent, computed, ref, toRef,
} from 'vue';

import IntegerInterface from '../../interfaces/IntegerInterface.js';
import CustomForm from './CustomForm.vue';

export default defineComponent({
    props: {
        modelValue: {
            type: Object,
            default: () => {},
        },
        intf: {
            type: Object,
            required: true,
        },
    },
    setup(props) {
        const dynamicTemplates = ref([]);
        const config = toRef(props.intf, 'config');
        const defValue = toRef(props.intf, 'value');

        const resizeArray = (size) => {
            if (config.value.length > size) {
                config.value.splice(size);
            } else if (config.value.length < size) {
                const toAppend = Array.from({ length: size - config.value.length }, () => ({}));
                config.value.push(...toAppend);
            }
        };

        const update = (v) => {
            const baseName = props.intf.name;
            const { template } = props.intf;
            dynamicTemplates.value = [];
            resizeArray(v);
            let i = 0;

            for (; i < v; i += 1) {
                const name = `${baseName}_${i}`;
                dynamicTemplates.value.push(
                    [
                        name, template,
                    ],
                );
            }
        };
        // add first element
        update(defValue.value);
        /* eslint-disable vue/no-mutating-props */
        /* eslint-disable no-param-reassign */
        const amountOfProp = computed(() => {
            const { min } = props.intf;
            const { max } = props.intf;
            const lengthOfDynamic = config.value.length;

            const option = new IntegerInterface('Elements count', lengthOfDynamic, min, max);

            option.events.setValue.subscribe(this, (v) => {
                update(v);
            });
            option.setDefaultComponent();
            return option;
        });

        return {
            amountOfProp, CustomForm, dynamicTemplates, config,
        };
    },
});
</script>
