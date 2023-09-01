<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!--
Defines the main editor component - canvas in which the pipeline is drawn and
edited by a user

Inherits from baklavajs/rendered-vue/src/editor/Editor.vue

Minimap component is removed whatsoever as they are not used.
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
        @wheel.self="mouseWheel"
        @keydown="keyDown"
        @keyup="keyUp"
        oncontextmenu="return false;"
    >
        <slot name="background">
            <background />
        </slot>

        <slot name="sidebar" v-if="!hideHud">
            <CustomSidebar />
        </slot>

        <slot name="palette" v-if="!(readonly || hideHud)">
            <NodePalette />
        </slot>

        <div class="node-container" :style="nodeContainerStyle" @wheel="mouseWheel">
            <CustomNode
                v-for="node in visibleNodes"
                :key="node.id + counter.toString()"
                :node="node"
                :selected="selectedNodes.includes(node)"
                :interfaces="highlightInterfaces"
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
import { EditorComponent, useGraph } from '@baklavajs/renderer-vue';
import { defineComponent, ref, computed, watch, onMounted } from 'vue';
import usePanZoom from './panZoom';

import CustomNode from './CustomNode.vue';
import PipelineManagerConnection from './connection/PipelineManagerConnection.vue';
import TemporaryConnection from './connection/TemporaryConnection.vue';
import NodePalette from './nodepalette/NodePalette.vue';
import { useTemporaryConnection } from './temporaryConnection';
import NotificationHandler from '../core/notifications';
import EditorManager from '../core/EditorManager';
import CustomSidebar from './CustomSidebar.vue';

export default defineComponent({
    extends: EditorComponent,
    components: {
        CustomNode,
        PipelineManagerConnection,
        TemporaryConnection,
        NodePalette,
        CustomSidebar,
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
        } = EditorComponent.setup(props);

        const connRefs = ref([]);
        const { graph } = useGraph();

        const panZoom = usePanZoom();
        const temporaryConnection = useTemporaryConnection();
        const editorManager = EditorManager.getEditorManagerInstance();

        const highlightConnections = ref([]);
        const highlightInterfaces = ref([]);

        const readonly = computed(() => props.viewModel.editor.readonly);
        const hideHud = computed(() => props.viewModel.hideHud);

        const unselectAllNodes = () => {
            /* eslint-disable vue/no-mutating-props,no-param-reassign */
            props.viewModel.displayedGraph.selectedNodes = [];
        };

        const onPointerDown = (ev) => {
            if (ev.target === el.value) {
                unselectAllNodes();
                panZoom.onPointerDown(ev);
            }
            temporaryConnection.onMouseDown();
        };

        const onPointerMove = (ev) => {
            panZoom.onPointerMove(ev);
            temporaryConnection.onMouseMove(ev);
        };

        const onPointerUp = (ev) => {
            panZoom.onPointerUp(ev);
            temporaryConnection.onMouseUp();

            document.removeEventListener('mouseup', onPointerUp);
            document.removeEventListener('mousemove', onPointerMove);
        };

        document.addEventListener('mousedown', (ev) => {
            if (ev.button === 0) {
                onPointerDown(ev);
                document.addEventListener('mouseup', onPointerUp);
                document.addEventListener('mousemove', onPointerMove);
            }
        });

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

        const addInterfaceHighlight = (it) => {
            if (!highlightInterfaces.value.includes(it)) {
                highlightInterfaces.value.push(it);
            }
        };
        const clearInterfaceHighlight = () => {
            highlightInterfaces.value.splice(0, highlightInterfaces.value.length);
        };

        watch(temporaryConnection?.temporaryConnection, () => {
            if (typeof (temporaryConnection ?? null) === 'undefined') return;
            if (temporaryConnection?.temporaryConnection === null) return;
            if (temporaryConnection?.temporaryConnection?.value?.from) {
                for (let a = 0; a < nodes.value.length; a += 1) {
                    const viableConnections = [
                        ...(Object.values(nodes.value[a].outputs) || []),
                        ...(Object.values(nodes.value[a].inputs) || []),
                    ];

                    viableConnections.forEach((n) => {
                        if (n.port && n !== temporaryConnection.temporaryConnection.value.from) {
                            const result = graph.value.checkConnection(
                                temporaryConnection.temporaryConnection.value.from,
                                n,
                            );
                            if (!result.connectionAllowed) {
                                addInterfaceHighlight(n);
                            }
                        }
                    });
                }
            } else {
                clearInterfaceHighlight();
            }
        });

        const removeHighlight = (connection) => {
            const index = highlightConnections.value.indexOf(connection);
            if (index >= 0) {
                highlightConnections.value.splice(index, 1);
            }
        };

        const changeHoveredConnections = (ev) => {
            // Get all connection DOM elements that have mouse hovered over them
            const elements = document.elementsFromPoint(ev.clientX, ev.clientY);

            const hoveredHtml = connRefs.value.filter((conn) =>
                conn.containsPoint(elements),
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
        const ignorableLayers = computed(() => props.viewModel.layers);

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
                    !c.from.type?.some((t) => ignoredInterfacesTypes.value.has(t)) &&
                    !c.to.type?.some((t) => ignoredInterfacesTypes.value.has(t)) &&
                    !ignoredNodesId.value.includes(c.from.nodeId) &&
                    !ignoredNodesId.value.includes(c.to.nodeId),
            ),
        );

        const scale = computed(() => graph.value.scaling);

        const defaultSpecification = process.env.VUE_APP_SPECIFICATION_PATH !== undefined;
        const defaultDataflow = process.env.VUE_APP_DATAFLOW_PATH !== undefined;
        const verboseLoad =
            process.env.VUE_APP_VERBOSE !== undefined && process.env.VUE_APP_VERBOSE === 'true';

        /**
         * Prepares the Editor based on specification configuration.
         *
         * The function validates the specification, updates the Editor
         * and provides error messages for erroneous content.
         *
         * @param specification The object holding the parsed specification file
         */
        function updateEditorSpecification(specification) {
            let errors = editorManager.validateSpecification(specification);
            let warnings;
            if (errors.length) {
                NotificationHandler.terminalLog('error', 'Specification is invalid', errors);
                return errors;
            }

            ({ errors, warnings } = editorManager.updateEditorSpecification(specification)); // eslint-disable-line prefer-const,max-len
            if (Array.isArray(warnings) && warnings.length) {
                NotificationHandler.terminalLog(
                    'warning',
                    'Issue when loading specification',
                    warnings,
                );
            }
            if (Array.isArray(errors) && errors.length) {
                NotificationHandler.terminalLog('error', 'Specification is invalid', errors);
            }

            return errors;
        }

        /**
         * Loads the JSON file from the remote location given in URL.
         *
         * @param {string} location the URL location of the resource
         * @returns a string with JSON data or undefined if the
         * downloading/parsing of the JSON failed
         */
        async function loadJsonFromRemoteLocation(location) {
            let fetchedContent;
            try {
                fetchedContent = await fetch(location, { mode: 'cors' });
            } catch (error) {
                NotificationHandler.terminalLog(
                    'error',
                    `Could not download the resource from:  ${location}. Reason: ${error.message}`,
                );
                return undefined;
            }
            try {
                const jsonContent = await fetchedContent.json();
                return jsonContent;
            } catch (error) {
                NotificationHandler.terminalLog(
                    'error',
                    `Could not parse the JSON resource from: ${location}. Reason: ${error.message}`,
                );
                return undefined;
            }
        }

        /* eslint-disable no-lonely-if */
        onMounted(async () => {
            NotificationHandler.setShowNotification(false);
            editorManager.updateMetadata({}); // Defaulting metadata values

            let specText;
            if (!defaultSpecification) {
                // Try loading default specification and/or dataflow from URLs provided in an
                // escaped form in the page's URL
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has('spec')) {
                    specText = await loadJsonFromRemoteLocation(urlParams.get('spec'));
                    if (specText === undefined) {
                        NotificationHandler.terminalLog(
                            'error',
                            `Failed to load the specification file from: ${urlParams.get('spec')}`,
                        );
                    }
                }
            } else {
                // Use raw-loader which does not parse the specification so that it is possible
                // To add a more verbose validation log
                if (verboseLoad) {
                    specText =
                        require(`!!raw-loader!${process.env.VUE_APP_SPECIFICATION_PATH}`).default; // eslint-disable-line global-require,import/no-dynamic-require
                } else {
                    specText = require(process.env.VUE_APP_SPECIFICATION_PATH); // eslint-disable-line global-require,import/no-dynamic-require,max-len
                }
            }

            if (specText !== undefined) {
                let errors = updateEditorSpecification(specText);

                if (errors.length) {
                    NotificationHandler.restoreShowNotification();
                    return;
                }

                let dataflow;
                if (defaultDataflow) {
                    dataflow = require(process.env.VUE_APP_DATAFLOW_PATH); // eslint-disable-line global-require,max-len,import/no-dynamic-require
                } else {
                    const urlParams = new URLSearchParams(window.location.search);
                    if (urlParams.has('graph')) {
                        dataflow = await loadJsonFromRemoteLocation(urlParams.get('graph'));
                        if (!dataflow) {
                            NotificationHandler.terminalLog(
                                'error',
                                `Failed to load the graph file from: ${urlParams.get('graph')}`,
                            );
                        }
                    }
                }
                if (dataflow) {
                    let warnings;
                    ({ errors, warnings } = await editorManager.loadDataflow(dataflow));
                    if (Array.isArray(warnings) && warnings.length) {
                        NotificationHandler.terminalLog(
                            'warning',
                            'Issue when loading dataflow',
                            warnings,
                        );
                    }
                    if (Array.isArray(errors) && errors.length) {
                        const messageTitle = process.env.VUE_APP_GRAPH_DEVELOPMENT_MODE === 'true' ?
                            'Softload enabled, errors found while loading the dataflow' :
                            'Dataflow is invalid';
                        NotificationHandler.terminalLog('error', messageTitle, errors);
                    }
                }
            }
            NotificationHandler.restoreShowNotification();
        });

        const cache = {};
        // Importing all assets to a cache so that they can be accessed dynamically during runtime
        function importAll(r) {
            r.keys().forEach((key) => (cache[key] = r(key))); // eslint-disable-line no-return-assign,max-len
        }
        try {
            importAll(require.context('../../assets', true, /\.(|svg|png)$/));
        } catch (e) {
            // assets directory not found
        } finally {
            props.viewModel.cache = cache;
        }

        return {
            el,
            counter,
            selectedNodes,
            nodeContainerStyle,
            onPointerMove,
            onPointerDown,
            onPointerUp,
            nodes,
            keyDown,
            keyUp,
            selectNode,
            temporaryConnection: temporaryConnection.temporaryConnection,
            mouseWheel: panZoom.onMouseWheel,
            dragging: panZoom.dragging,
            changeHoveredConnections,
            highlightConnections,
            connRefs,
            clearHighlight,
            readonly,
            hideHud,
            scale,
            visibleConnections,
            visibleNodes,
            highlightInterfaces,
        };
    },
});
</script>
