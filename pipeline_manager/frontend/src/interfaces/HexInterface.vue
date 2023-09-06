<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div>
        <input
            ref="el"
            v-model="v"
            type="text"
            class="baklava-input hex-input"
            :class="{ '--invalid': invalid }"
            :placeholder="intf.name"
            :title="intf.name"
            @keypress="handleRestrictedKeys"
        />
    </div>
</template>

<script>
import { computed, defineComponent, ref } from 'vue';

const restrictedKeys = /[^a-f0-9x]/i;
const hexScheme = /^0x[a-fA-F0-9]+$/;

export default defineComponent({
    props: {
        intf: {
            required: true,
        },
        modelValue: {
            type: String,
            required: true,
        },
    },
    emits: ['update:modelValue'],
    setup(props, { emit }) {
        const el = ref(null);

        const handleRestrictedKeys = (event) => {
            if (event.key.length === 1 && restrictedKeys.test(event.key)) {
                event.preventDefault();
            }
        };

        const v = computed({
            get: () => props.modelValue,
            set: (val) => {
                emit('update:modelValue', val);
                el.value.value = props.intf.value;
            },
        });
        const invalid = computed(() => !hexScheme.test(props.intf.value));

        return {
            v, el, handleRestrictedKeys, invalid,
        };
    },
});
</script>

<style lang="scss">
.hex-input {
  text-align: right;
}
</style>
