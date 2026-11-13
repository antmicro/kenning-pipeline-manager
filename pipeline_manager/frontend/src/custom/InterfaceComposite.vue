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
            :style="nested >= 1 ?
                { [intf.side]: `calc(-1.1em - ${nested} * var(--kpm-nested-indent))` } : {}"
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
        <Chevron
            :rotate="expanded ? 'down' : invSide"
            v-if="subPorts.length"
            class="__port_composite_toggle"
            :class="toggleClasses"
            no-drag="true"
            @pointerdown.left.stop.prevent
            @click.stop="toggleComposite"
            />
        <template v-if="expanded">
            <CustomInterface
                v-for="sub in subPorts"
                :key="sub.id"
                :intf="sub"
                :node="node"
                :picked="picked"
                :switch-sides="noop"
                :nested="nested + 1"
            />
        </template>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import Arrow from '../icons/Arrow.vue';
import ExternalNameInput from './ExternalNameInput.vue';
import CustomInterface from './CustomInterface.vue';
import Chevron from '../icons/Chevron.vue';
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
    nested: { default: 0, required: false },
});

const noop = () => {};

const expanded = computed(() => props.intf.compositeExpanded ?? false);

const subPorts = computed(() => getCompositePorts(props.intf));

const invSide = computed(() => (props.intf.side === 'left' ? 'right' : 'left'));

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

    & .baklava-node-interface {
        position: relative;
        &:not(:has(> .__port_composite_expanded)):last-child {
            border-color: transparent;
            &.--input {
                &::before {
                    border-width: 0 0 1px 1px;
                }
            }
            &.--output {
                &::before {
                    border-width: 0 1px 1px 0;
                }
            }
        }
        &::before {
            content: '';
            display: block;
            position: absolute;
            width: var(--kpm-nested-indent);
            top: 0;
            height: calc(1em + 1px);
            border: 1px solid #{$gray-100};
            border-width: 0 0 1px 0;
        }
        &.--input {
            &::before {
                left: -1px;
            }
            border-left: 1px solid #{$gray-100};
            margin-left: var(--kpm-nested-indent);
            & > .__port-name {
                padding-left: 1em;
            }
        }
        &.--output {
            &::before {
                right: -1px;
            }
            border-right: 1px solid #{$gray-100};
            margin-right: var(--kpm-nested-indent);
            & > .__port-name {
                padding-right: 1em;
            }
        }
        & .__port_composite {
            & > .__port_composite_toggle {
                right: var(--kpm-nested-indent);
            }
            & > .__port_composite_toggle_left {
                left: var(--kpm-nested-indent);
            }
        }
    }

    &.__port_composite_expanded {
        & > .__port_composite_port {
            position: absolute;
            top: calc(50% - 0.5em);
            opacity: 0;
            pointer-events: none;
        }
    }

    .__port_composite_toggle {
        position: absolute;
        top: 1em;
        right: -0.3em;
        z-index: 2;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.1em;
        height: 1.1em;
        padding: 0.1em;
        font-size: 0.7em;
        line-height: 1;
        color: var(--baklava-control-color-foreground);
        cursor: pointer;

        &:hover {
            color: var(--baklava-control-color-background);
        }

        &.__port_composite_toggle_left {
            right: auto;
            left: -0.3em;
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

    &.--composite-expanded {
        & > .__port-name {
            font-weight: bold;
            font-size: 1.125em;
        }
    }
}
</style>
