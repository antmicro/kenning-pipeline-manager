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
        <div class="__port_composite_strip" :style="{ 'background-color': groupColor }" ></div>
        <button
            v-if="subPorts.length"
            type="button"
            class="__port_composite_toggle"
            :class="toggleClasses"
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
                :picked="picked"
                :switch-sides="noop"
            />
        </template>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useViewModel } from '@baklavajs/renderer-vue';
import Arrow from '../icons/Arrow.vue';
import ExternalNameInput from './ExternalNameInput.vue';
import CustomInterface from './CustomInterface.vue';
import { CustomNodeInterface } from './CustomNodeInterface.js';
import { CustomNode } from '../core/NodeFactory.js';
import { getCompositePorts, toggleCompositeInterfaces } from './compositeInterfaces';

const props = defineProps({
    intf: { type: CustomNodeInterface, required: true },
    node: { type: CustomNode, required: true },
    highlighted: { type: Boolean, required: true },
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

const { viewModel } = useViewModel();

const expanded = computed(() => props.intf.compositeExpanded ?? false);

const subPorts = computed(() => getCompositePorts(props.intf));

const groupColor = computed(() => {
    if (!expanded.value) {
        return undefined;
    }
    const types = viewModel.value?.interfaceTypes?.types ?? {};
    const intfTypes = Array.isArray(props.intf.type) ? props.intf.type : [props.intf.type];
    return intfTypes
        .map((type) => types[type]?.interfaceColor)
        .find((color) => color !== undefined);
});

const toggleTitle = computed(() => (expanded.value
    ? 'Collapse the composite interface'
    : 'Expand the composite interface'));

const toggleComposite = () => {
    toggleCompositeInterfaces(props.intf, props.graph);
};
const toggleClasses = computed(() => ({
    __port_composite_toggle_left: props.intf.side === 'left',
    __port_composite_toggle_expanded: expanded.value,
}));
</script>

<style lang="scss">
.__port_composite {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    margin-left: -0.5em;
    margin-right: -0.5em;

    &.__port_composite_expanded {
        & > .__port_composite_port {
            position: absolute;
            top: calc(50% - 0.5em);
            opacity: 0;
            pointer-events: none;
        }
    }

    .__port_composite_strip {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 0.3em;
        border-radius: 2px;
        pointer-events: none;
    }

    .__port_composite_toggle {
        position: absolute;
        top: 1.1em;
        right: 0.1em;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.1em;
        height: 1.1em;
        padding: 0;
        font-size: 0.7em;
        line-height: 1;
        color: var(--baklava-control-color-foreground);
        background-color: var(--baklava-control-color-background);
        border: solid 1px var(--baklava-control-color-primary);
        border-radius: 50%;
        cursor: pointer;

        &:hover {
            color: var(--baklava-control-color-background);
            background-color: var(--baklava-control-color-primary);
        }

        &.__port_composite_toggle_left {
            right: auto;
            left: 0.1em;
        }

        &.__port_composite_toggle_expanded {
            top: 1.6em;
        }
    }
}

.baklava-node-interface {
    &.--output .__port_composite .__port_composite_port {
        align-self: flex-end;
    }

    &.--input .__port_composite .__port_composite_port {
        align-self: flex-start;
    }

    // the invisible anchor stays on the port edge of the respective side
    &.--output .__port_composite.__port_composite_expanded .__port_composite_port {
        right: -1em;
    }

    &.--input .__port_composite.__port_composite_expanded .__port_composite_port {
        left: -1em;
    }

    // the group strip runs along the ports, on the respective side
    &.--output .__port_composite .__port_composite_strip {
        right: 0;
    }

    &.--input .__port_composite .__port_composite_strip {
        left: 0;
    }

    // the composite port (and its name) hides while unrolled
    &.--composite-expanded {
        padding: 0.8em !important;
        & > .__port-name {
            font-weight: bold;
            font-size: 1.125em;
        }
    }

    // add margin to port's name to make space for __port_composite_toggle
    &.--input .__port-name:has(+ .__port_composite) {
        margin-left: 0.5em;
    }
    &.--output .__port-name:has(+ .__port_composite) {
        margin-right: 0.5em;
    }
}
</style>
