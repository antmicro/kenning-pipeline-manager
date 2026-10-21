<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
The composite (hierarchically grouped) port of a node interface: an interface
created out of an `interfaceComposites` specification entry.
-->

<template>
    <div
        class="__port_composite"
        :class="{ '__port_composite_expanded': expanded }"
    >
        <div
            class="__port __port_composite_port"
            :class="{
                greyedout_arrow: highlighted,
                picked: picked,
                '__square': isExposed,
                '__port_composite_port_hidden': expanded,
            }"
            @mouseenter="startHoverWrapper"
            @mouseleave="endHoverWrapper"
            @pointerdown.left="onMouseDown"
            no-drag="true"
        >
            <ExternalNameInput
                :intf="intf"
                :visible="isExposed && hovered && !expanded"
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
        <button
            v-if="subPorts.length"
            type="button"
            class="__port_composite_toggle"
            :class="{ '__port_composite_toggle_left': intf.side === 'left' }"
            :title="toggleTitle"
            no-drag="true"
            @pointerdown.left.stop.prevent
            @click.stop="toggleComposite"
        >
            {{ expanded ? '−' : '+' }}
        </button>
        <template v-if="expanded">
            <CustomInterface
                v-for="sub in subPorts"
                :key="sub.id"
                :intf="sub"
                :node="node"
                :highlighted="highlighted"
                :picked="picked"
                :switch-sides="noop"
            />
        </template>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Arrow from '../icons/Arrow.vue';
import ExternalNameInput from './ExternalNameInput.vue';
import CustomInterface from './CustomInterface.vue';
import { getCompositePorts, toggleCompositeInterfaces } from './compositeInterfaces';

const props = defineProps({
    intf: { type: Object, required: true },
    node: { type: Object, required: true },
    highlighted: { type: Boolean, default: false },
    picked: { type: Boolean, default: false },
    isExposed: { type: Boolean, default: false },
    hovered: { type: Boolean, default: false },
    displayArrow: { type: Boolean, default: false },
    arrowRotation: { type: String, default: 'down' },
    startHoverWrapper: { type: Function, required: true },
    endHoverWrapper: { type: Function, required: true },
    onMouseDown: { type: Function, required: true },
    graph: { type: Object, required: true },
});

const noop = () => {};

const expanded = computed(() => props.intf.compositeExpanded ?? false);

const subPorts = computed(() => getCompositePorts(props.intf));

const toggleTitle = computed(() => (expanded.value
    ? 'Collapse the composite interface'
    : 'Expand the composite interface'));

const toggleComposite = () => {
    toggleCompositeInterfaces(props.intf, props.graph);
};
</script>
