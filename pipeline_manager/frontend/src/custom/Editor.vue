<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Defines the main editor component - canvas in which the pipeline is drawn and
edited by a user

Inherits from baklavajs-plugin-rendered-vue/src/components/Editor.vue

`v-if` directive is added to ContextMenu component so that it is not displayed if the editor
is in `readonly` mode.

Prop `plugin` (that is an instance of ViewPlugin class) is made reactive, so that
all descendants of this component get a valid reference to it.
It is done using computed() function.

Sidebar and Minimap components are removed whatsoever as they are not used.
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
            @mouseenter="changeHoveredConnections($event)"
            @mousemove="changeHoveredConnections($event)"
            @mouseleave="changeHoveredConnections($event)"
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
            v-if="!plugin.editor.readonly"
            :is="plugin.components.contextMenu"
            highlightConnections
            v-model="contextMenu.show"
            :x="contextMenu.x"
            :y="contextMenu.y"
            :items="contextMenu.items"
            flippable
            @click="onContextMenuClick"
        ></component>

        <slot></slot>
    </div>
</template>

<script>
import { Editor } from '@baklavajs/plugin-renderer-vue';
import { computed } from 'vue';

export default {
    extends: Editor,

    props: ['plugin'],

    provide() {
        return {
            plugin: computed(() => this.plugin),
        };
    },

    data() {
        return {
            highlightConnections: [],
        };
    },

    methods: {
        /**
         * Highlights the connection. Doesn't change anything if
         * connection is already highlighted
         *
         * @param connection Connection to highlight
         */
        addHighlight(connection) {
            if (!this.highlightConnections.includes(connection)) {
                this.highlightConnections.push(connection);
            }
        },

        /**
         * Removes the highlight for input connection. Doesn't do anything
         * if connection was not highlighted
         *
         * @param connection Connection to return to standard state
         */
        removeHighlight(connection) {
            const index = this.highlightConnections.indexOf(connection);
            if (index >= 0) {
                this.highlightConnections.splice(index, 1);
            }
        },

        /**
         * On mouse movement checks all drawn connections whether mouse is
         * hovered over them. Adds highlight to all hovered connections,
         * removed highlight for the rest.
         *
         * @param ev Event specifying current mouse position
         */
        changeHoveredConnections(ev) {
            // Get all connection DOM elements that have mouse hovered over them
            const connectionContainer = document.getElementsByClassName('connections-container')[0];
            const connectionsHtml = this.$children.filter((el) =>
                connectionContainer.contains(el.$el),
            );
            const hoveredHtml = connectionsHtml.filter((el) =>
                el.containsPoint(ev.clientX, ev.clientY),
            );
            // Convert DOM elements to BaklavaJS connections
            const hovered = this.connections.filter(
                (conn) => hoveredHtml.filter((el) => el.connection === conn).length > 0,
            );
            // Applies highlight to all connections that share the input interface with a
            // connection mouse is hovered over
            const highlighted = this.standardConnections
                .concat(this.highlightConnections)
                .filter((conn) => hovered.filter((hov) => hov.from === conn.from).length > 0);

            this.standardConnections
                .filter((conn) => highlighted.includes(conn))
                .forEach(this.addHighlight);
            this.highlightConnections
                .filter((conn) => !highlighted.includes(conn))
                .forEach(this.removeHighlight);
        },
    },

    watch: {
        connections(newConnections) {
            this.highlightConnections = this.highlightConnections.filter((conn) =>
                newConnections.includes(conn),
            );
        },
    },

    computed: {
        standardConnections() {
            return this.connections.filter((conn) => !this.highlightConnections.includes(conn));
        },
    },
};
</script>
