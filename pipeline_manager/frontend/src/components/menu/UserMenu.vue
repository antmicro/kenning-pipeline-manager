<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Popup menu for choosing save options.
-->

<!-- eslint-disable vue/no-mutating-props -->
<template>
    <div class="create-menu">
        <CustomForm
            :saveConfiguration="saveConfiguration"
            :saveConfigurationTemplate="saveConfigurationTemplate"
        />
        <component
            :is="save.component"
            :intf="save"
        />
    </div>
</template>

<script>
import {
    defineComponent, computed, toRef,
} from 'vue';

import ButtonInterface from '../../interfaces/ButtonInterface.js';
import getExternalApplicationManager from '../../core/communication/ExternalApplicationManager.js';
import CustomForm from './CustomForm.vue';

export default defineComponent({
    components: {
        CustomForm,
    },
    props: {
        buttonTitle: {
            required: true,
            type: String,
        },
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
        const externalApplicationManager = getExternalApplicationManager();

        const saveConfiguration = toRef(props, 'saveConfiguration');

        const save = computed(() => new ButtonInterface(`${props.buttonTitle}`, () => {
            // send API response
            externalApplicationManager.requestUserDialogRead(saveConfiguration.value);
        }));

        return { save };
    },
});
</script>
