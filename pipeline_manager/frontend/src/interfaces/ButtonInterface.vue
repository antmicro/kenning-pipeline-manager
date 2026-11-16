<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <button
        class="baklava-button --block"
        :title="intf.description ?? intf.name"
        @click="onClick"
    >
        {{ intf.name }}
    </button>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
    props: {
        intf: {
            type: Object,
            required: true,
        },
    },
    setup(props) {
        const onClick = () => {
            if (props.intf.callback) {
                props.intf.callback();
            }
        };
        return { onClick };
    },
});
</script>
