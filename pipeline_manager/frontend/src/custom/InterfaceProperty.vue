<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
The property/name part of a node interface. Element holding the property's
control.
-->

<template>
    <div
        no-drag="true"
        class="__port-name"
        @mouseenter="startPropertyHover"
        @mouseleave="endPropertyHover"
        :class="spanClasses"
    >
        <!-- @keydown.stop is added so that events are not bubbled up to the editor -->
        <!-- eslint-disable vue/no-mutating-props -->
        <component
            :is="intf.component"
            v-if="showComponent"
            v-model="intf.value"
            :node="node"
            :intf="intf"
            @keydown.stop
            :tabindex="tabindexValue"
            @click="setValue"
            @input="setValue"
        />
        <!-- eslint-enable vue/no-mutating-props -->
        <span v-else-if="!intf.bus?.size">
            {{ intf.name }}
        </span>
        <ExternalNameInput
            :intf="intf"
            :visible="isExposed && propertyHovered && !intf.port && !sidebar"
            wrapper-class="__property_name"
            input-class="__property_input"
        />
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useViewModel } from '@baklavajs/renderer-vue';
import { ir } from '../core/interfaceRegistry.ts';
import getExternalApplicationManager from '../core/communication/ExternalApplicationManager';
import ExternalNameInput from './ExternalNameInput.vue';
import { CustomNodeInterface } from './CustomNodeInterface.js';
import { CustomNode } from '../core/NodeFactory.js';

const props = defineProps({
    intf: { type: CustomNodeInterface, required: true },
    node: { type: CustomNode, default: null },
    positioned: { type: Boolean, default: false },
    hiddenName: { type: Boolean, default: false },
    showComponent: { type: Boolean, default: false },
    tabindexValue: { type: Number, default: -1 },
    isExposed: { type: Boolean, default: false },
    propertyHovered: { type: Boolean, default: false },
    sidebar: { type: Boolean, default: false },
    startPropertyHover: { type: Function, required: true },
    endPropertyHover: { type: Function, required: true },
});
const { viewModel } = useViewModel();

const spanClasses = computed(() => ({
    highlighted: props.positioned,
    hidden: (props.positioned && !props.propertyHovered) || props.hiddenName,
    '--positioned': props.positioned,
    '--top': props.intf.side === 'top' && props.positioned,
    '--bottom': props.intf.side === 'bottom' && props.positioned,
    '--left': props.intf.side === 'left' && props.positioned,
    '--right': props.intf.side === 'right' && props.positioned,
    '--input': props.intf.direction === 'input' && props.positioned,
    '--output': props.intf.direction === 'output' && props.positioned,
    '--inout': props.intf.direction === 'inout' && props.positioned,
}));

const reportedValues = new Map();

const reportEdit = () => {
    if (props.intf.port || !props.node) return;
    const now = JSON.stringify(props.intf.value);
    if (reportedValues.get(props.intf.id) === now) return;
    reportedValues.set(props.intf.id, now);
    getExternalApplicationManager().notifyAboutChange('properties_on_change', {
        graph_id: props.node.graphInstance.id,
        node_id: props.node.id,
        properties: [{ id: props.intf.id, new_value: props.intf.value }],
    });
};

const setValue = () => {
    reportEdit();
    if (!props.intf.value) return;
    if (!(props.isExposed.value || ir.isRegistered(props.intf.id))) return;

    const { editor } = viewModel.value;
    const allNodes = Array.from(editor.graphs).map((g) => g.nodes).flat();
    const allProperties = allNodes.map((n) => Object.entries(n.inputs)).flat()
        .filter(([key, _]) => key.startsWith('property_'));
    const exposedProperties = allProperties.map(([_, value]) => value)
        .filter((prop) => prop.id === props.intf.id);

    // eslint-disable-next-line no-return-assign,no-param-reassign
    exposedProperties.forEach((prop) => prop.value = props.intf.value);
};

// A property's edit, reported to the external application
// (`properties_on_change`, with `notifyWhenChanged`). Here, where the
// edit is made, rather than by watching the property: a graph node's
// exposed properties are not seen by a watch, nor do they emit their
// `setValue` where their node does, so their edits went unreported.
// Once per value, the first edit too; not a value set by code.
if (!props.intf.port && !reportedValues.has(props.intf.id)) {
    reportedValues.set(props.intf.id, JSON.stringify(props.intf.value));
}
</script>
