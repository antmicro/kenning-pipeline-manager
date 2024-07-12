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
import { defineComponent, computed } from 'vue';
import { SliderInterfaceComponent } from '@baklavajs/renderer-vue';

export default defineComponent({
    extends: SliderInterfaceComponent,
    setup(props) {
        const percentageFixed = computed(() =>
            Math.min(
                100,
                Math.max(
                    0,
                    ((props.intf.value - props.intf.min) * 100) / (props.intf.max - props.intf.min),
                ),
            ),
        );
        return { ...SliderInterfaceComponent.setup(props), percentageFixed };
    },
});
</script>
