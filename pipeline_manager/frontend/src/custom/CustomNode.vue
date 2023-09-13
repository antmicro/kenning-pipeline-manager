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
        @pointerdown.left.self="select()"
        oncontextmenu="return false;"
    >
        <div class="interface-cursor">
            <div class="line" :style="interfaceCursorStyle"></div>
        </div>
        <div
            class="__title"
            @pointerdown.left.exact="onMouseDown"
            @pointerdown.left.self.stop="startDragWrapper($event)"
            @pointerdown.right="openContextMenuTitle"
        >
            <img
                class="__title-icon"
                v-if="iconPath !== undefined"
                :src="iconPath"
            >
            <div v-if="!renaming" class="__title-label">
                {{ nodeTitle }}
            </div>
            <input
                v-else
                type="text"
                class="dark-input"
                v-model="tempName"
                placeholder="Node Name"
                ref="renameField"
                v-click-outside="doneRenaming"
                @keydown.enter="doneRenaming"
            />
            <CustomContextMenu
                v-if="showContextMenuTitle"
                v-model="showContextMenuTitle"
                :x="contextMenuTitleX"
                :y="contextMenuTitleY"
                :items="contextMenuTitleItems"
                :urls="nodeURLs"
                :style="contextMenuStyle"
                @click="onContextMenuTitleClick"
            />
        </div>

        <div class="__content">
            <!-- Properties -->
            <div class="__properties">
                <div v-for="input in displayedProperties" :key="input.id">
                    {{ getOptionName(input.componentName) ? `${input.name}:` : '' }}
                    <CustomInterface :node="node" :intf="input" :toggleGroup="toggleGroup" />
                </div>
            </div>

            <!-- Outputs -->
            <div class="__outputs" ref="rightSocketsRefs">
                <template v-for="output in displayedRightRows">
                    <CustomInterface
                        :key="output.id"
                        v-if="output"
                        @pointerdown.left.shift="pickInterface(output, $event)"
                        @pointerdown.right.exact="openContextMenuInterface(output, $event)"
                        :node="node"
                        :intf="output"
                        :highlighted="props.interfaces.includes(output)"
                        :picked="isPickedInterface(output)"
                        :switchSides="switchSides"
                    />
                    <!-- eslint-disable-next-line vue/require-v-for-key -->
                    <div v-else class="baklava-node-interface --output">&nbsp;</div>
                </template>
            </div>

            <!-- Inputs -->
            <div class="__inputs" ref="leftSocketsRefs">
                <template v-for="input in displayedLeftRows">
                    <CustomInterface
                        :key="input.id"
                        v-if="input"
                        @pointerdown.left.shift="pickInterface(input, $event)"
                        @pointerdown.right.exact="openContextMenuInterface(input, $event)"
                        :node="node"
                        :intf="input"
                        :highlighted="props.interfaces.includes(input)"
                        :picked="isPickedInterface(input)"
                        :switchSides="switchSides"
                    />
                    <!-- eslint-disable-next-line vue/require-v-for-key -->
                    <div v-else class="baklava-node-interface --input">&nbsp;</div>
                </template>
            </div>

            <CustomContextMenu
                v-if="showContextMenuInterface"
                v-model="showContextMenuInterface"
                :x="contextMenuInterfaceX"
                :y="contextMenuInterfaceY"
                :items="contextMenuInterfaceItems"
                :style="contextMenuStyle"
                @click="onContextMenuInterfaceClick"
            />
        </div>
    </div>
</template>

<script setup>
/* eslint-disable object-curly-newline */
import { ref, computed, toRef, onUpdated, onMounted, nextTick, markRaw, watch } from 'vue';
import { useViewModel, useGraph } from '@baklavajs/renderer-vue';
import { AbstractNode, GRAPH_NODE_TYPE_PREFIX } from '@baklavajs/core';

import useGroupDragMove from './useGroupDragMove';
import CustomInterface from './CustomInterface.vue';
import CustomContextMenu from './ContextMenu.vue';
import { gridSnapper } from '../core/snappers';
import Pencil from '../icons/Pencil.vue';
import Bin from '../icons/Bin.vue';
import Disconnect from '../icons/Disconnect.vue';
import Sidebar from '../icons/Sidebar.vue';
import doubleClick from '../core/doubleClick.js';
import {
    startTransaction, commitTransaction,
} from '../core/History.ts';

import NotificationHandler from '../core/notifications.js';

import InputInterfaceComponent from '../interfaces/InputInterface.vue';
import ListInterfaceComponent from '../interfaces/ListInterface.vue';
import SliderInterfaceComponent from '../interfaces/SliderInterface.vue';

// Baklavajs implementation

const props = defineProps({
    node: AbstractNode,
    selected: Boolean,
    interfaces: Array,
});

const emit = defineEmits(['select']);

const { viewModel } = useViewModel();
const { graph } = useGraph();
const movementStep = computed(() => viewModel.value.movementStep);

const contextMenuStyle = computed(() => ({
    'transform-origin': '0 0',
    transform: `scale(${1 / graph.value.scaling})`,
}));

// If type start with '_', it is not displayed as node title
const IGNORE_TYPE_PREFIX = '_';

const nodeRef = ref(null);
const renaming = ref(false);
const renameField = ref(null);
const tempName = ref('');

const nodeURLs = viewModel.value.editor.getNodeURLs(props.node.type);

const displayedInputs = computed(() => Object.values(props.node.inputs).filter((ni) => !ni.hidden));
const displayedOutputs = computed(() =>
    Object.values(props.node.outputs).filter((ni) => !ni.hidden),
);

const focusOnRename = () => {
    renameField.value.focus();
    renameField.value.select();
};

// Title context menu
const showContextMenuTitle = ref(false);
const contextMenuTitleX = ref(0);
const contextMenuTitleY = ref(0);
const contextMenuTitleItems = computed(() => {
    const items = [];
    if (!viewModel.value.editor.readonly) {
        items.push(
            { value: 'rename', label: 'Rename', icon: Pencil },
            { value: 'delete', label: 'Delete', icon: Bin },
            { value: 'disconnect', label: 'Disconnect', icon: Disconnect },
        );
    }

    if (!viewModel.value.hideHud) {
        items.push({ value: 'sidebar', label: 'Details', icon: Sidebar });
    }

    items.push(...nodeURLs);

    if (props.node.type.startsWith(GRAPH_NODE_TYPE_PREFIX)) {
        items.push({ value: 'editSubgraph', label: 'Edit Subgraph' });
    }

    return items;
});

const openSidebar = () => {
    const { sidebar } = viewModel.value.displayedGraph;
    sidebar.nodeId = props.node.id;
    sidebar.visible = true;
};

/* eslint-disable default-case */
const onContextMenuTitleClick = async (action) => {
    switch (action) {
        case 'delete':
            startTransaction();
            graph.value.removeNode(props.node);
            commitTransaction();
            break;
        case 'rename':
            tempName.value = props.node.title;
            renaming.value = true;
            await nextTick();
            focusOnRename();
            break;
        case 'disconnect': {
            startTransaction();
            const nodeConnections = graph.value.connections.filter(
                (c) =>
                    (displayedInputs.value.find((i) => i === c.from || i === c.to) !== undefined) ||
                    (displayedOutputs.value.find((i) => i === c.from || i === c.to) !== undefined),
            );
            nodeConnections.forEach((c) => {
                graph.value.removeConnection(c);
            });
            commitTransaction();
        } break;
        case 'sidebar':
            openSidebar();
            break;
        case 'editSubgraph': {
            const errors = viewModel.value.editor.switchToSubgraph(props.node);
            if (Array.isArray(errors) && errors.length) {
                NotificationHandler.terminalLog('error', 'Dataflow is invalid', errors);
            }
            break;
        }
    }
};

const openContextMenuTitle = (ev) => {
    if (showContextMenuTitle.value === false) {
        contextMenuTitleX.value = ev.offsetX;
        contextMenuTitleY.value = ev.offsetY;
        showContextMenuTitle.value = true;
    }
};

const groupDragMove = useGroupDragMove(
    toRef(props.node, 'position'),
    props.node.id,
    gridSnapper(movementStep),
);

const classes = computed(() => ({
    '--selected': props.selected,
    '--dragging': groupDragMove.dragging.value,
    '--two-column': !!props.node.twoColumn,
    __readonly: viewModel.value.editor.readonly,
}));

const styles = computed(() => ({
    top: `${props.node.position?.y ?? 0}px`,
    left: `${props.node.position?.x ?? 0}px`,
    width: `${props.node.width ?? 200}px`,
}));

const nodeTitle = computed(() => {
    if (props.node.type.startsWith(IGNORE_TYPE_PREFIX)) {
        return props.node.title;
    }
    if (props.node.title === props.node.type || props.node.title === '') {
        return props.node.type;
    }
    return `${props.node.title} (${props.node.type})`;
});

const select = () => {
    emit('select');
};

let abortDrag;
let stopDrag;

const cleanEvents = () => {
    document.removeEventListener('pointermove', groupDragMove.onPointerMove);
    document.removeEventListener('keyboard.escape', abortDrag);
    document.removeEventListener('pointerup', stopDrag);
};

abortDrag = () => {
    cleanEvents();
};

stopDrag = () => {
    groupDragMove.onPointerUp();
    cleanEvents();
};

const startDrag = (ev) => {
    if (!graph.value.selectedNodes.includes(props.node)) {
        select();
    }

    groupDragMove.onPointerDown(ev);
    document.addEventListener('pointermove', groupDragMove.onPointerMove);
    document.addEventListener('keyboard.escape', abortDrag);
    document.addEventListener('pointerup', stopDrag);
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

const openDoubleClick = doubleClick(700, () => {
    if (!viewModel.value.editor.readonly) {
        openSidebar();
    }
});

/* eslint-disable vue/no-mutating-props,no-param-reassign */
const onMouseDown = () => {
    const { sidebar } = viewModel.value.displayedGraph;
    if (sidebar.visible) {
        sidebar.nodeId = props.node.id;
    }

    openDoubleClick();
};

const displayedProperties = computed(() =>
    Object.values(displayedInputs.value).filter((intf) => !intf.port),
);

const displayedLeftSockets = computed(() =>
    Object.values([...displayedInputs.value, ...displayedOutputs.value])
        .filter((intf) => intf.side === 'left' && intf.port)
        .sort((intf1, intf2) => intf1.sidePosition - intf2.sidePosition),
);

const displayedRightSockets = computed(() =>
    Object.values([...displayedInputs.value, ...displayedOutputs.value])
        .filter((intf) => intf.side === 'right' && intf.port)
        .sort((intf1, intf2) => intf1.sidePosition - intf2.sidePosition),
);

const getRows = (sockets) => {
    if (!sockets.length) {
        return [];
    }

    const numOfLines = Math.max(
        displayedLeftSockets.value.at(-1)?.sidePosition ?? 0,
        displayedRightSockets.value.at(-1)?.sidePosition ?? 0,
    );

    let numOfSocket = 0;
    const rows = [];

    for (let i = 0; i <= numOfLines; i += 1) {
        if (sockets[numOfSocket]?.sidePosition === i) {
            rows.push(sockets[numOfSocket]);
            numOfSocket += 1;
        } else {
            rows.push(undefined);
        }
    }
    return rows;
};

const displayedRightRows = computed(() => getRows(displayedRightSockets.value));
const displayedLeftRows = computed(() => getRows(displayedLeftSockets.value));

displayedProperties.value.forEach((prop) => {
    if (prop.component === undefined) {
        if (prop.componentName === 'InputInterface') {
            prop.setComponent(markRaw(InputInterfaceComponent));
        } else if (prop.componentName === 'ListInterface') {
            prop.setComponent(markRaw(ListInterfaceComponent));
        } else if (prop.componentName === 'SliderInterface') {
            prop.setComponent(markRaw(SliderInterfaceComponent));
        }
    }
});

const path = viewModel.value.editor.getNodeIconPath(props.node.type);
const iconPath = viewModel.value.cache[`./${path}`] ?? path;

// Interface modification

let newSocketIndex;
let chosenInterface;

const leftSocketsRefs = ref(null);
const rightSocketsRefs = ref(null);

const interfaceCursorStyle = ref({
    top: '0px',
    left: '0px',
    display: 'none',
});

const isPickedInterface = (intf) => intf === chosenInterface;

const assignNewPosition = () => {
    let sockets;
    if (chosenInterface.side === 'right') {
        sockets = displayedRightRows.value;
    } else if (chosenInterface.side === 'left') {
        sockets = displayedLeftRows.value;
    }

    if (sockets[newSocketIndex] !== undefined) {
        sockets[newSocketIndex].sidePosition = chosenInterface.sidePosition;
    }
    chosenInterface.sidePosition = newSocketIndex;
};

const dragInterface = (ev) => {
    let sockets;
    if (chosenInterface.side === 'right') {
        sockets = rightSocketsRefs.value;
    } else if (chosenInterface.side === 'left') {
        sockets = leftSocketsRefs.value;
    }

    // Finding the first interface that is lower than the cursor
    let socket = [...sockets.children].findIndex((socketRef) => {
        const boundingRect = socketRef.getBoundingClientRect();
        return boundingRect.bottom > ev.clientY;
    });
    newSocketIndex = socket;

    if (socket === -1) {
        socket = sockets.children.length - 1;
        newSocketIndex = sockets.children.length - 1;
    }

    const el = sockets.children[socket];
    interfaceCursorStyle.value = {
        top: `${el.offsetTop + el.offsetHeight / 2 - 2.5}px`,
        display: 'block',
    };

    if (chosenInterface.side === 'right') {
        interfaceCursorStyle.value.right = '-0.7em';
    } else if (chosenInterface.side === 'left') {
        interfaceCursorStyle.value.left = '-0.7em';
    }
};

const dropInterface = () => {
    assignNewPosition();

    chosenInterface = undefined;
    interfaceCursorStyle.value = {
        top: '0px',
        left: '0px',
        rigth: '0px',
        display: 'none',
    };

    document.removeEventListener('mousemove', dragInterface);
    document.removeEventListener('mouseup', dropInterface);
};

const pickInterface = (intf, ev) => {
    chosenInterface = intf;
    dragInterface(ev);

    document.addEventListener('mousemove', dragInterface);
    document.addEventListener('mouseup', dropInterface);
};

// Interface context menu

const showContextMenuInterface = ref(false);
const contextMenuInterfaceX = ref(0);
const contextMenuInterfaceY = ref(0);
const contextMenuInterfaceItems = computed(() => {
    const items = [
        { value: 'SpaceUp', label: 'Space Up' },
        { value: 'SpaceDown', label: 'Space Down' },
        { value: 'MoveUp', label: 'Move Up' },
        { value: 'MoveDown', label: 'Move Down' },
    ];

    return items;
});

/* eslint-disable default-case */
const onContextMenuInterfaceClick = (action) => {
    switch (action) {
        case 'MoveUp':
            if (chosenInterface.sidePosition === 0) {
                chosenInterface = undefined;
                break;
            }
            newSocketIndex = chosenInterface.sidePosition - 1;
            dropInterface();
            break;
        case 'MoveDown':
            newSocketIndex = chosenInterface.sidePosition + 1;
            dropInterface();
            break;
        case 'SpaceUp': {
            const sockets =
                chosenInterface.side === 'right'
                    ? displayedRightRows.value
                    : displayedLeftRows.value;
            Object.values(sockets).forEach((intf) => {
                if (intf !== undefined && intf.sidePosition >= chosenInterface.sidePosition) {
                    intf.sidePosition += 1; // eslint-disable-line no-param-reassign
                }
            });
            break;
        }
        case 'SpaceDown': {
            const sockets =
                chosenInterface.side === 'right'
                    ? displayedRightRows.value
                    : displayedLeftRows.value;
            Object.values(sockets).forEach((intf) => {
                if (intf !== undefined && intf.sidePosition > chosenInterface.sidePosition) {
                    intf.sidePosition += 1; // eslint-disable-line no-param-reassign
                }
            });
            break;
        }
    }
};

const openContextMenuInterface = (intf, ev) => {
    if (!viewModel.value.editor.readonly && showContextMenuInterface.value === false) {
        chosenInterface = intf;
        if (chosenInterface.side === 'right') {
            contextMenuInterfaceX.value = ev.currentTarget.offsetLeft + 162.5;
            contextMenuInterfaceY.value = ev.currentTarget.offsetTop + 12.5;
        } else if (chosenInterface.side === 'left') {
            contextMenuInterfaceX.value =
                ev.currentTarget.offsetLeft - ev.currentTarget.offsetWidth + 162.5;
            contextMenuInterfaceY.value = ev.currentTarget.offsetTop + 12.5;
        }

        showContextMenuInterface.value = true;
    }
};

watch(showContextMenuInterface, () => {
    if (showContextMenuInterface.value === false) {
        chosenInterface = undefined;
    }
});

const toggleGroup = (intf) => {
    intf.group.forEach((name) => {
        props.node.inputs[name].hidden = intf.value;
    });
};

/* eslint-disable no-param-reassign */
const switchSides = (intf) => {
    // Switching side of an interface and if the opposite place is occupied then then
    // the interface is moved to the last row
    if (intf.side === 'left') {
        const l = displayedLeftRows.value.indexOf(intf);
        if (displayedRightRows.value[l]) {
            intf.sidePosition = displayedRightRows.value.length;
        }
        intf.side = 'right';
    } else {
        const r = displayedRightRows.value.indexOf(intf);
        if (displayedLeftRows.value[r]) {
            intf.sidePosition = displayedLeftRows.value.length;
        }
        intf.side = 'left';
    }
};
</script>

<style lang="scss" scoped>
.interface-cursor {
    position: relative;
    top: 0;
    left: 0;

    & > .line {
        position: absolute;
        height: 0.2em;
        width: 1.4em;
        background-color: $gold;
        z-index: 100;
    }
}

.baklava-node {
    &.__readonly  {
        > .__title {
            cursor: auto;
        }
    }
}
</style>
