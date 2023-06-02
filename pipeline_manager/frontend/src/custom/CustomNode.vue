<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
The baklavajs functionality was fully copied to this component, as the original
implementation uses `<script setup>` which does not work well with `extends` feature.

Aside from the original source code, the custom node implements displaying name tags
for properties that do not display them, support for readonly mode that prevents the user
from moving or deleting the nodes.
 -->

<template>
    <div
        :id="node.id"
        ref="nodeRef"
        class="baklava-node"
        :class="classes"
        :style="styles"
        :data-node-type="node.type"
        @pointerdown="select"
    >
        <div class="__title" @pointerdown.self.stop="startDragWrapper">
            <img class="__title-icon" v-if="nodeIcon !== undefined" :src="nodeIcon" />
            <div v-if="!renaming" class="__title-label">
                {{ nodeTitle }}
            </div>
            <input
                v-else
                type="text"
                class="dark-input"
                v-model="tempName"
                placeholder="Node Name"
                v-click-outside="doneRenaming"
                @keydown.enter="doneRenaming"
            />
            <a
                v-for="url in nodeURLs"
                :key="url.name"
                :href="url.url"
                class="__url"
                :class="openClass"
                @pointerdown.stop
                @pointerover="hover = true"
                @pointerleave="hover = false"
                target="_blank"
            >
                <img
                    v-if="getIconPath(url.icon) !== undefined"
                    :src="getIconPath(url.icon)"
                    :alt="url.name"
                />
                <div class="__tooltip">{{ url.name }}</div>
            </a>
            <div class="__menu">
                <vertical-dots class="--clickable" @click="openContextMenuWrapper" />
                <context-menu
                    v-model="showContextMenu"
                    :x="0"
                    :y="0"
                    :items="contextMenuItems"
                    @click="onContextMenuClick"
                />
            </div>
        </div>

        <div class="__content">
            <!-- Properties -->
            <div class="__properties">
                <!-- eslint-disable vue/require-v-for-key -->
                <div v-for="input in displayedProperties">
                    {{ getOptionName(input.componentName) ? `${input.name}:` : '' }}
                    <CustomInterface :key="input.id" :node="node" :intf="input" />
                </div>
            </div>

            <!-- Outputs -->
            <div class="__outputs">
                <CustomInterface
                    v-for="output in displayedRightSockets"
                    :key="output.id"
                    :node="node"
                    :intf="output"
                />
            </div>

            <!-- Inputs -->
            <div class="__inputs">
                <!-- eslint-disable vue/require-v-for-key -->
                <CustomInterface
                    v-for="input in displayedLeftSockets"
                    :key="input.id"
                    :node="node"
                    :intf="input"
                />
            </div>
        </div>
    </div>
</template>

<script setup>
/* eslint-disable object-curly-newline */
import { ref, computed, toRef, onUpdated, onMounted } from 'vue';
import {
    useDragMove,
    useViewModel,
    AbstractNode,
    Components,
    GRAPH_NODE_TYPE_PREFIX,
    useGraph,
} from 'baklavajs';

import CustomInterface from './CustomInterface.vue';
import VerticalDots from '../components/VerticalDots.vue';

const { ContextMenu } = Components;

// Baklavajs implementation

const props = defineProps({
    node: AbstractNode,
    selected: Boolean,
});

const emit = defineEmits(['select']);

const { viewModel } = useViewModel();
const { graph, switchGraph } = useGraph();
const dragMove = useDragMove(toRef(props.node, 'position'));

const nodeRef = ref(null);
const renaming = ref(false);
const tempName = ref('');

const showContextMenu = ref(false);
const contextMenuItems = computed(() => {
    const items = [
        { value: 'delete', label: 'Delete' },
        { value: 'rename', label: 'Rename' },
    ];

    if (props.node.type.startsWith(GRAPH_NODE_TYPE_PREFIX)) {
        items.push({ value: 'editSubgraph', label: 'Edit Subgraph' });
    }

    return items;
});

const classes = computed(() => ({
    '--selected': props.selected,
    '--dragging': dragMove.dragging.value,
    '--two-column': !!props.node.twoColumn,
}));

const styles = computed(() => ({
    top: `${props.node.position?.y ?? 0}px`,
    left: `${props.node.position?.x ?? 0}px`,
    width: `${props.node.width ?? 200}px`,
}));

const displayedInputs = computed(() => Object.values(props.node.inputs).filter((ni) => !ni.hidden));
const displayedOutputs = computed(() =>
    Object.values(props.node.outputs).filter((ni) => !ni.hidden),
);

const nodeTitle = computed(() => {
    if (props.node.title === props.node.type || props.node.title === '') {
        return props.node.type;
    }
    return `${props.node.title} (${props.node.type})`;
});

const select = () => {
    emit('select');
};

const stopDrag = () => {
    dragMove.onPointerUp();
    document.removeEventListener('pointermove', dragMove.onPointerMove);
    document.removeEventListener('pointerup', stopDrag);
};

const startDrag = (ev) => {
    dragMove.onPointerDown(ev);
    document.addEventListener('pointermove', dragMove.onPointerMove);
    document.addEventListener('pointerup', stopDrag);
    select();
};

const openContextMenu = () => {
    showContextMenu.value = true;
};

const nodeURLs = viewModel.value.editor.getNodeURLs(props.node.type);
const getIconPath = (name) => (name !== undefined ? `./assets/${name}` : undefined);
const hover = ref(false);
const openClass = computed(() => ({ open: hover.value }));

/* eslint-disable default-case */
const onContextMenuClick = async (action) => {
    switch (action) {
        case 'delete':
            graph.value.removeNode(props.node);
            break;
        case 'rename':
            tempName.value = props.node.title;
            renaming.value = true;
            break;
        case 'editSubgraph':
            switchGraph(props.node.template);
            break;
    }
};

const doneRenaming = () => {
    graph.value.findNodeById(props.node.id).title = tempName.value;
    renaming.value = false;
};

const onRender = () => {
    if (nodeRef.value) {
        viewModel.value.hooks.renderNode.execute({ node: props.node, el: nodeRef.value });
    }
};

onMounted(onRender);
onUpdated(onRender);

// ----------

/**
 * The function decides whether a name for the option should be displayed.
 *
 * @param optionType Name of the option component
 * @returns True if the name should be displayed, false otherwise.
 */

const getOptionName = (optionType) => {
    switch (optionType) {
        case 'InputInterface':
        case 'SelectInterface':
        case 'ListInterface':
        case 'TextInterface':
            return true;
        case 'NumberInterface':
        case 'IntegerInterface':
        case 'CheckboxInterface':
        case 'SliderInterface':
        case 'NodeInterface':
        default:
            return false;
    }
};

/**
 * Wrapper that prevents node moving if the editor is in read-only mode.
 *
 * @param ev Event
 */
const startDragWrapper = (ev) => {
    if (!viewModel.value.editor.readonly) {
        startDrag(ev);
    }
};

/**
 * Wrapper that prevents opening the context menu if the editor is in read-only mode.
 *
 * @param ev Event
 */
const openContextMenuWrapper = (ev) => {
    if (!viewModel.value.editor.readonly) {
        openContextMenu(ev);
    }
};

const displayedLeftSockets = computed(() =>
    Object.values([...displayedInputs.value, ...displayedOutputs.value]).filter(
        (intf) => intf.connectionSide === 'left' && intf.port,
    ),
);
const displayedRightSockets = computed(() =>
    Object.values([...displayedInputs.value, ...displayedOutputs.value]).filter(
        (intf) => intf.connectionSide === 'right' && intf.port,
    ),
);
const displayedProperties = computed(() =>
    Object.values(displayedInputs.value).filter((intf) => !intf.port),
);

const iconPath = viewModel.value.editor.getNodeIconPath(props.node.type);
const nodeIcon = iconPath !== undefined ? `./assets/${iconPath}` : undefined; // eslint-disable-line global-require,max-len,import/no-dynamic-require
</script>
