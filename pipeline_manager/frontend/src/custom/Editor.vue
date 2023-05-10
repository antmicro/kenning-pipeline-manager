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

        <slot name="palette">
            <node-palette />
        </slot>

        <svg
            class="connections-container"
            @mouseenter="changeHoveredConnections"
            @mousemove="changeHoveredConnections"
            @mouseleave="clearHighlight"
        >
            <g v-for="connection in connections" :key="connection.id + counter.toString()">
                <PipelineManagerConnection
                    :connection="connection"
                    ref="connRefs"
                    :isHighlighted="highlightConnections.includes(connection)"
                />
            </g>
            <slot name="temporaryConnection" :temporary-connection="temporaryConnection">
                <temporary-connection
                    v-if="temporaryConnection"
                    :connection="temporaryConnection"
                />
            </slot>
        </svg>

        <div class="node-container" :style="nodeContainerStyle">
            <transition-group name="fade">
                <CustomNode
                    v-for="node in nodes"
                    :key="node.id + counter.toString()"
                    :node="node"
                    :selected="selectedNodes.includes(node)"
                    @select="selectNode(node)"
                />
            </transition-group>
        </div>
    </div>
</template>

<script>
import { EditorComponent } from 'baklavajs';
import { defineComponent, ref } from 'vue';
import CustomNode from './CustomNode.vue';
import PipelineManagerConnection from './connection/PipelineManagerConnection.vue';

export default defineComponent({
    extends: EditorComponent,
    components: {
        CustomNode,
        PipelineManagerConnection,
    },
    setup(props) {
        const {
            el,
            counter,
            nodes,
            connections,
            selectedNodes,
            nodeContainerStyle,
            onPointerMove,
            onPointerDown,
            onPointerUp,
            keyDown,
            keyUp,
            selectNode,
            temporaryConnection,
            mouseWheel,
            dragging,
        } = EditorComponent.setup(props);

        const connRefs = ref([]);

        const highlightConnections = ref([]);

        const clearHighlight = () => {
            highlightConnections.value.splice(0, highlightConnections.value.length);
        };

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

        return {
            el,
            counter,
            nodes,
            connections,
            selectedNodes,
            nodeContainerStyle,
            onPointerMove,
            onPointerDown,
            onPointerUp,
            keyDown,
            keyUp,
            selectNode,
            temporaryConnection,
            mouseWheel,
            dragging,
            changeHoveredConnections,
            highlightConnections,
            connRefs,
            clearHighlight,
        };
    },
});
</script>
