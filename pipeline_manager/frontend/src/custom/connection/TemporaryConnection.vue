<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <ConnectionView
        :x1="swappedD.input[0]"
        :y1="swappedD.input[1]"
        :x2="swappedD.output[0]"
        :y2="swappedD.output[1]"
        :state="status"
        :connection="connection"
        is-temporary
    />
</template>

<script>
import { computed } from 'vue';
import { Components } from '@baklavajs/renderer-vue';
import ConnectionView from './ConnectionView.vue';

export default {
    extends: Components.TemporaryConnection,
    components: {
        ConnectionView,
    },
    setup(props) {
        const { d, status } = Components.TemporaryConnection.setup(props);

        const swappedD = computed(() => {
            let { input, output } = d.value;

            // Currently, baklavajs swaps the input/output if this condition holds
            // We want to have no discrepancy between the input output coordinates
            // and connection from/to values.
            if (props.connection.from.isInput) {
                [input, output] = [output, input];
            }

            return { input, output };
        });

        return { d, swappedD, status };
    },
};
</script>
