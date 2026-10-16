<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
The normal (non-positioned) port of a node interface.
-->

<template>
    <div
        class="__port"
        @mouseenter="startHoverWrapper"
        @mouseleave="endHoverWrapper"
        @pointerdown.left="onMouseDown"
        no-drag="true"
        :class="{
            greyedout_arrow: highlighted,
            picked: picked,
            '__square': isExposed,
        }"
    >
        <ExternalNameInput
            :intf="intf"
            :visible="isExposed && hovered"
            :wrapper-class="{
                '__port_name_left': intf.side === 'left',
                '__port_name_top': intf.side == 'top',
                '__port_name_right': intf.side === 'right',
                '__port_name_bottom': intf.side == 'bottom'
            }"
        />
        <Arrow
            v-if="displayArrow"
            :noninteractable="true"
            color="black"
            scale="big"
            :rotate="arrowRotation"
        />
    </div>
</template>

<script setup>
import Arrow from '../icons/Arrow.vue';
import ExternalNameInput from './ExternalNameInput.vue';
import { CustomNodeInterface } from './CustomNodeInterface.js';

defineProps({
    intf: { type: CustomNodeInterface, required: true },
    highlighted: { type: Boolean, default: false },
    picked: { type: Boolean, default: false },
    isExposed: { type: Boolean, default: false },
    hovered: { type: Boolean, default: false },
    displayArrow: { type: Boolean, default: false },
    arrowRotation: { type: String, default: 'down' },
    startHoverWrapper: { type: Function, required: true },
    endHoverWrapper: { type: Function, required: true },
    onMouseDown: { type: Function, required: true },
});
</script>
