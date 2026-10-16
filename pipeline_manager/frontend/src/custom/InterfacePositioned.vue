<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
The positioned (custom shape) port of a node interface.
-->

<template>
    <div
        class="__port __port_centered"
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
<style lang="scss">
.baklava-node-interface.--positioned {
  padding: 0;
  width: fit-content;
  height: fit-content;
}
.__port_centered {
  left: calc(50% - .5em);
}
.--positioned {
  display: block;
}
.__port,
.__square {
  background-color: var(--baklava-control-color-primary);
  width: 1em;
  height: 1em;
  top: calc(50% - 0.5em);
  & > svg {
    position: absolute;
    top: 0;
    left: 0;
    height: 1em;
    width: 1em;
  }
}
</style>
