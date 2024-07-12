<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div
        ref="el"
        class="baklava-slider"
        :class="{ 'baklava-ignore-mouse': !editMode }"
        @pointerdown="mousedown"
        @pointerup="mouseup"
        @pointermove="mousemove"
        @pointerleave="mouseleave"
    >
        <div class="__slider" :style="{ width: percentageFixed + '%' }" />
        <div v-if="!editMode" class="__content">
            <div class="__label">
                {{ intf.name }}
            </div>
            <div class="__value">
                {{ stringRepresentation }}
            </div>
        </div>
        <div v-else class="__content">
            <input
                ref="inputEl"
                v-model="tempValue"
                type="number"
                class="baklava-input"
                :class="{ '--invalid': invalid }"
                style="text-align: right"
                @blur="leaveEditMode"
                @keydown.enter="leaveEditMode"
                tabindex="-1"
            />
        </div>
    </div>
</template>

<script>
import { defineComponent, computed, toRef } from 'vue';
import { SliderInterfaceComponent } from '@baklavajs/renderer-vue';

const MAX_STRING_LENGTH = 9;

export default defineComponent({
    extends: SliderInterfaceComponent,
    setup(props) {
        const intf = toRef(props, 'intf');
        const interfaceComponent = SliderInterfaceComponent.setup(props);

        const adjustValue = (value) => {
            let currentValue = value;
            if (props.intf.step !== undefined) {
                currentValue = Math.round((value - props.intf.min) / props.intf.step);
                currentValue = currentValue * props.intf.step + props.intf.min;
            }
            if (currentValue <= props.intf.min) {
                return props.intf.min;
            } if (currentValue >= props.intf.max) {
                return props.intf.max;
            }
            return currentValue;
        };

        const percentageFixed = computed(() => {
            const adjustedValue = adjustValue(props.intf.value);
            const range = props.intf.max - props.intf.min;
            return Math.min(
                100,
                Math.max(
                    0,
                    ((adjustedValue - props.intf.min) * 100) / range,
                ),
            );
        });

        const leaveEditMode = () => {
            const v = parseFloat(interfaceComponent.tempValue.value);
            if (!interfaceComponent.validate(v)) {
                interfaceComponent.invalid.value = true;
            } else {
                intf.value.value = adjustValue(v);
                interfaceComponent.editMode.value = false;
            }
        };

        const stringRepresentation = computed(() => {
            // eslint-disable-next-line vue/no-side-effects-in-computed-properties
            intf.value.value = adjustValue(props.intf.value);
            const s = props.intf.value.toFixed(3);
            return s.length > MAX_STRING_LENGTH ? intf.value.value.toExponential(MAX_STRING_LENGTH - 5) : s; // eslint-disable-line max-len
        });

        return {
            ...interfaceComponent, percentageFixed, leaveEditMode, stringRepresentation,
        };
    },
});
</script>
