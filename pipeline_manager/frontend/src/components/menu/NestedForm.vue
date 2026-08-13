<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Component for generating nested form.
-->

<!-- eslint-disable vue/no-mutating-props -->
 <!-- eslint-disable no-param-reassign -->
<template>
    <div class="create-menu">
        <div>{{intf.name}}:</div>
        <div class="dynamic-list">
            <div class="dynamic-list-view">
                <component
                    :is="CustomForm"
                    :saveConfigurationTemplate="intf.template"
                    :saveConfiguration="intf.config"
                />
            </div>
        </div>
    </div>
</template>

<script>
import {
    defineComponent,
} from 'vue';

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
    setup() {
        return {
            CustomForm,
        };
    },
});
</script>
