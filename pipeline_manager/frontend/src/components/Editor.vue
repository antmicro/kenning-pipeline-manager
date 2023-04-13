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

        <svg class="connections-container">
            <g v-for="connection in connections" :key="connection.id + counter.toString()">
                <slot name="connections" :connection="connection">
                    <component
                        :is="plugin.components.connection"
                        :connection="connection"
                    ></component>
                </slot>
            </g>
            <component
                :is="plugin.components.connection"
                v-if="highlightConnection"
                :connection="highlightConnection"
                is-highlighted
            ></component>
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

export default {
    extends: Editor,

    data: {
        highlightConnection: undefined
    },

    methods: {
        addHighlight(connection) {
            if(!!this.highlightConnection) {
                this.connections.push(this.highlightConnection);
            }
            const index = this.connections.indexOf(connection);
            this.connections.splice(index, 1);
            this.highlightConnection = connection;
        },

        removeHighlight(connection) {
            if(this.highlightConnection === connection) {
                this.connections.push(this.highlightConnection);
                this.highlightConnection = undefined;
            }
        }
    },

    computed: {
        unfocusedConnections() {
            return this.connections.filter(
                conn => conn !== this.highlightConnection
            );
        }
    }
}
</script>
