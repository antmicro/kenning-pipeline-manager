<!--
Copyright (c) 2022-2025 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="baklava-num-input">
        <div class="__button --dec" @click="decrement">
            <i-arrow />
        </div>
        <div v-if="!editMode || intf.readonly" class="__content" @click="enterEditMode">
            <div class="__label" :title="intf.name">
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
            >
        </div>
        <div class="__button --inc" @click="increment">
            <i-arrow />
        </div>
    </div>
</template>

<script>
import { defineComponent } from 'vue';
import { NumberInterfaceComponent } from '@baklavajs/renderer-vue';

export default defineComponent({
    extends: NumberInterfaceComponent,
    setup(props) {
        const interfaceComponent = NumberInterfaceComponent.setup(props);
        const increment = props.intf.readonly ? () => {} : interfaceComponent.increment;
        const decrement = props.intf.readonly ? () => {} : interfaceComponent.decrement;
        return { ...interfaceComponent, increment, decrement };
    },
});
</script>
