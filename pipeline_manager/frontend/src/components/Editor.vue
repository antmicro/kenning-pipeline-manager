<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->


<template>
    <div
        tabindex="-1"
        :class="[
            'node-editor',
            {
                'ignore-mouse': !!temporaryConnection,
                '--temporary-connection': !!temporaryConnection,
            },
        ]"
        @mousemove.self="mouseMoveHandler"
        @mousedown="mouseDown"
        @mouseup="mouseUp"
        @wheel.self="mouseWheel"
        @keydown="keyDown"
        @keyup="keyUp"
        @contextmenu.self.prevent="openContextMenu"
    >
        <div class="background" :style="backgroundStyle"></div>

        <svg
            class="connections-container"
            @mouseenter="changeHovereConnections($event)"
            @mousemove="changeHovereConnections($event)"
            @mouseleave="changeHovereConnections($event)"
        >
            <g v-for="connection in standardConnections" :key="connection.id + counter.toString()">
                <slot name="connections" :connection="connection">
                    <component
                        :is="plugin.components.connection"
                        :connection="connection"
                    ></component>
                </slot>
            </g>
            <g v-for="connection in highlightConnections" :key="connection.id + counter.toString()">
                <slot name="highlightConnections" :connection="connection">
                    <component
                        :is="plugin.components.connection"
                        :connection="connection"
                        is-highlighted
                    ></component>
                </slot>
            </g>
            <component
                :is="plugin.components.tempConnection"
                v-if="temporaryConnection"
                :connection="temporaryConnection"
            ></component>
        </svg>

        <div class="node-container" :style="styles">
            <component
                :is="plugin.components.node"
                v-for="node in nodes"
                :key="node.id + counter.toString()"
                :data="node"
                :selected="selectedNodes.includes(node)"
                @select="selectNode(node, $event)"
            >
            </component>
        </div>

        <component
            :is="plugin.components.contextMenu"
            v-model="contextMenu.show"
            :x="contextMenu.x"
            :y="contextMenu.y"
            :items="contextMenu.items"
            flippable
            @click="onContextMenuClick"
        ></component>

        <component :is="plugin.components.sidebar"></component>

        <component
            v-if="plugin.enableMinimap"
            :is="plugin.components.minimap"
            :nodes="nodes"
            :connections="connections"
        ></component>

        <slot></slot>
    </div>
</template>

<script>
import { Editor } from '@baklavajs/plugin-renderer-vue';
import { toHash } from 'ajv/dist/compile/util';

export default {
    extends: Editor,

    data() {
        return {
            highlightConnections: []
        }
    },

    methods: {
        addHighlight(connection) {
            if(!this.highlightConnections.includes(connection)) {
                this.highlightConnections.push(connection);
            }
        },

        removeHighlight(connection) {
            const index = this.highlightConnections.indexOf(connection);
            if(index >= 0) {
                this.highlightConnections.splice(index, 1);
            }
        },

        changeHovereConnections(ev) {
            const connectionsHtml = this.$children.filter(el => el.$el.getAttribute("class") === "connection");
            const hoveredHtml = connectionsHtml.filter(el => el.containsPoint(ev.clientX, ev.clientY));
            const hovered = this.connections.filter(
                conn => hoveredHtml.filter(el => el.connection === conn).length > 0
            )
            this.standardConnections.filter(conn => hovered.includes(conn)).forEach(this.addHighlight);
            this.highlightConnections.filter(conn => !hovered.includes(conn)).forEach(this.removeHighlight);
        }
    },

    watch: {
        connections(newConnections) {
            this.highlightConnections = this.highlightConnections.filter(conn => newConnections.includes(conn));
        }
    },

    computed: {
        standardConnections() {
            return this.connections
        }
    }
}
</script>
