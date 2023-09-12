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
            @blur="handleBlur"
        />
    </div>
</template>

<script>
import { computed, defineComponent, ref } from 'vue';

const restrictedKeys = /[^a-f0-9]/i;
const hexScheme = /^0x[a-fA-F0-9]+$/;
const swapPrefix = /^((.*)0)?((.*)x)?/;

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
                let validatedVal;
                let cursorPosition;
                if (!val.startsWith('0x') && swapPrefix.test(val)) {
                    const match = val.match(swapPrefix);
                    validatedVal = val.replace(swapPrefix, '0x$2$4');
                    const additionalLenght = ((match[2] ?? '').length) + ((match[4] ?? '').length);
                    cursorPosition = 2;
                    if (additionalLenght > 0) cursorPosition += additionalLenght;
                    else if (props.modelValue.length > validatedVal.length
                            || props.modelValue === '') {
                        cursorPosition += 1;
                    }
                } else {
                    validatedVal = val;
                }
                if (validatedVal === '0x') {
                    validatedVal = '';
                }
                emit('update:modelValue', validatedVal);
                el.value.value = props.intf.value;
                if (cursorPosition !== undefined) {
                    el.value.setSelectionRange(cursorPosition, cursorPosition);
                }
            },
        });
        const invalid = computed(() => !hexScheme.test(props.intf.value));

        const handleBlur = () => {
            emit('update:modelValue', props.modelValue.toLowerCase());
        };

        return {
            v, el, handleRestrictedKeys, handleBlur, invalid,
        };
    },
});
</script>

<style lang="scss">
.hex-input {
  text-align: right;
}
</style>
