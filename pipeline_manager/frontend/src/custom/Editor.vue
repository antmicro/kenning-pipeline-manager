<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Defines the main editor component - canvas in which the pipeline is drawn and
edited by a user

Inherits from baklavajs/rendered-vue/src/editor/Editor.vue

Sidebar and Minimap components are removed whatsoever as they are not used.
Hovered connections are calculated and rendered with an appropriate `isHighlighted` value.
-->

<template>
    <div
        ref="el"
        tabindex="-1"
        class="baklava-editor"
        :class="{
            'baklava-ignore-mouse': !!temporaryConnection || dragging,
            '--temporary-connection': !!temporaryConnection,
        }"
        :style="`--scale: ${this.scale}`"
        @pointermove.self="onPointerMove"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @wheel.self="mouseWheel"
        @keydown="keyDown"
        @keyup="keyUp"
    >
        <slot name="background">
            <background />
        </slot>

        <slot name="palette" v-if="!readonly">
            <NodePalette />
        </slot>

        <div class="node-container" :style="nodeContainerStyle">
            <CustomNode
                v-for="node in visibleNodes"
                :key="node.id + counter.toString()"
                :node="node"
                :selected="selectedNodes.includes(node)"
                @select="selectNode(node)"
            />
        </div>

        <svg
            class="connections-container"
            @mouseenter="changeHoveredConnections"
            @mousemove="changeHoveredConnections"
            @mouseleave="clearHighlight"
            @wheel="mouseWheel"
        >
            <PipelineManagerConnection
                v-for="connection in visibleConnections"
                :key="connection.id + counter.toString()"
                :connection="connection"
                ref="connRefs"
                :isHighlighted="highlightConnections.includes(connection)"
            />
            <TemporaryConnection
                name="temporaryConnection"
                :temporary-connection="temporaryConnection"
                v-if="temporaryConnection"
                :connection="temporaryConnection"
            />
        </svg>
    </div>
</template>

<script>
/* eslint-disable object-curly-newline */
import { EditorComponent, useGraph } from 'baklavajs';
import { defineComponent, ref, computed, watch } from 'vue';
import useDragMove from './useDragMove';

import CustomNode from './CustomNode.vue';
import PipelineManagerConnection from './connection/PipelineManagerConnection.vue';
import TemporaryConnection from './connection/TemporaryConnection.vue';
import NodePalette from './nodepalette/NodePalette.vue';
import { useTemporaryConnection } from './temporaryConnection';

export default defineComponent({
    extends: EditorComponent,
    components: {
        CustomNode,
        PipelineManagerConnection,
        TemporaryConnection,
        NodePalette,
    },
    setup(props) {
        const {
            el,
            counter,
            nodes,
            connections,
            selectedNodes,
            nodeContainerStyle,
            keyDown,
            keyUp,
            selectNode,
            mouseWheel,
            dragging,
        } = EditorComponent.setup(props);

        const connRefs = ref([]);
        const { graph } = useGraph();
        const panningRef = computed(() => graph.value.panning);
        const dragMove = useDragMove(panningRef);
        const temporaryConnection = useTemporaryConnection();

        const highlightConnections = ref([]);

        const readonly = computed(() => props.viewModel.editor.readonly);

        const unselectAllNodes = () => {
            /* eslint-disable vue/no-mutating-props,no-param-reassign */
            props.viewModel.displayedGraph.selectedNodes = [];
        };

        const onPointerDown = (ev) => {
            if (ev.button === 0) {
                if (ev.target === el.value) {
                    unselectAllNodes();
                    dragMove.onPointerDown(ev);
                }
                temporaryConnection.onMouseDown();
            }
        };

        const onPointerMove = (ev) => {
            dragMove.onPointerMove(ev);
            temporaryConnection.onMouseMove(ev);
        };

        const onPointerUp = (ev) => {
            dragMove.onPointerUp(ev);
            temporaryConnection.onMouseUp();
        };

        const clearHighlight = () => {
            highlightConnections.value.splice(0, highlightConnections.value.length);
        };

        // If a connection is removed by clicking on it all highlighted connections are removed
        watch(connections.value, () => {
            clearHighlight();
        });

        const addHighlight = (connection) => {
            if (!highlightConnections.value.includes(connection)) {
                highlightConnections.value.push(connection);
            }
        };

        const removeHighlight = (connection) => {
            const index = highlightConnections.value.indexOf(connection);
            if (index >= 0) {
                highlightConnections.value.splice(index, 1);
            }
        };

        const changeHoveredConnections = (ev) => {
            // Get all connection DOM elements that have mouse hovered over them
            const hoveredHtml = connRefs.value.filter((conn) =>
                conn.containsPoint(ev.clientX, ev.clientY),
            );

            // Convert DOM elements to BaklavaJS connections
            const hovered = connections.value.filter(
                (conn) => hoveredHtml.filter((htmlEl) => htmlEl.connection === conn).length > 0,
            );

            const highlighted = connections.value.filter(
                (conn) => hovered.filter((hov) => hov.from === conn.from).length > 0,
            );

            connections.value.forEach((conn) => {
                if (highlighted.includes(conn)) {
                    addHighlight(conn);
                } else {
                    removeHighlight(conn);
                }
            });
        };

        const ignoredLayers = computed(() => props.viewModel.ignoredLayers);
        const ignorableLayers = computed(() => props.viewModel.ignorableLayers);

        const ignoredInterfacesTypes = computed(() => {
            const temp = new Set();

            ignorableLayers.value.forEach((layer) => {
                if (layer.nodeInterfaces && ignoredLayers.value.has(layer.name)) {
                    layer.nodeInterfaces.forEach(temp.add, temp);
                }
            });
            return temp;
        });

        const ignoredNodesTypes = computed(() => {
            const temp = new Set();

            ignorableLayers.value.forEach((layer) => {
                if (layer.nodeTypes && ignoredLayers.value.has(layer.name)) {
                    layer.nodeTypes.forEach(temp.add, temp);
                }
            });
            return temp;
        });

        const visibleNodes = computed(() =>
            nodes.value.filter((n) => !ignoredNodesTypes.value.has(n.nodeType)),
        );
        const ignoredNodes = computed(() =>
            nodes.value.filter((n) => ignoredNodesTypes.value.has(n.nodeType)),
        );
        const ignoredNodesId = computed(() => ignoredNodes.value.map((n) => n.id));

        const visibleConnections = computed(() =>
            connections.value.filter(
                (c) =>
                    !c.from.type.some((t) => ignoredInterfacesTypes.value.has(t)) &&
                    !c.to.type.some((t) => ignoredInterfacesTypes.value.has(t)) &&
                    !ignoredNodesId.value.includes(c.from.nodeId) &&
                    !ignoredNodesId.value.includes(c.to.nodeId),
            ),
        );

        const scale = computed(() => graph.value.scaling);

        return {
            el,
            counter,
            selectedNodes,
            nodeContainerStyle,
            onPointerMove,
            onPointerDown,
            onPointerUp,
            keyDown,
            keyUp,
            selectNode,
            temporaryConnection: temporaryConnection.temporaryConnection,
            mouseWheel,
            dragging,
            changeHoveredConnections,
            highlightConnections,
            connRefs,
            clearHighlight,
            readonly,
            scale,
            visibleConnections,
            visibleNodes,
        };
    },
});
</script>
