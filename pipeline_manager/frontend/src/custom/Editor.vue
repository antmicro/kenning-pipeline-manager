<!--
Copyright (c) 2022-2025 Antmicro <www.antmicro.com>

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
        :style="editorStyle"
        @wheel.self="mouseWheel"
        @keydown="keyDown"
        @keyup="keyUp"
        @mouseleave="!readonly && onRightPointerUp"
        @drop.prevent="!readonly && onDrop($event)"
        @dragenter.prevent
        @dragover.prevent
        oncontextmenu="return false;"
    >
        <slot name="background">
            <background />
        </slot>

        <slot
            name="palette"
            v-if="!(readonly || hideHud)"
        >
            <NodePalette />
        </slot>

        <div class="node-container" :style="nodeContainerStyle" @wheel="mouseWheel">
            <CustomNode
                v-for="node in visibleNodes"
                :key="node.id + counter.toString()"
                :node="node"
                :selected="selectedNodes.includes(node)"
                :greyedOut="greyedOutNodes.includes(node)"
                :interfaces="highlightInterfaces"
                @select="(ev) => selectNode(node, ev)"
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
                v-if="temporaryConnection && temporaryConnectionRender"
                :connection="temporaryConnection"
            />
        </svg>

        <div class="selection-container">
            <RectangleSelection ref="rectangleSelection"/>
        </div>

        <Zoom @zoom-in="zoomIn" @zoom-out="zoomOut" @center="center" :floating="!hideHud" />

        <Return v-if="preview && isInSubgraph" @click="returnFromSubgraph" />
    </div>
</template>

<script>
/* eslint-disable object-curly-newline */
import { EditorComponent, useGraph } from '@baklavajs/renderer-vue';
import { defineComponent, ref, computed, watch, onMounted } from 'vue';
import fuzzysort from 'fuzzysort';
import { BaklavaEvent } from '@baklavajs/events';
import { isJSONRPCRequest, JSONRPC } from 'json-rpc-2.0';
import { v4 as uuidv4 } from 'uuid';
import usePanZoom from './panZoom';

import CustomNode from './CustomNode.vue';
import PipelineManagerConnection from './connection/PipelineManagerConnection.vue';
import TemporaryConnection from './connection/TemporaryConnection.vue';
import NodePalette from './nodepalette/NodePalette.vue';
import { useTemporaryConnection } from './temporaryConnection';
import NotificationHandler from '../core/notifications';
import EditorManager, { loadJsonFromRemoteLocation } from '../core/EditorManager';
import RectangleSelection from './RectangleSelection.vue';
import nodeInsideSelection from './rectangleSelection.js';
import getExternalApplicationManager from '../core/communication/ExternalApplicationManager';
import jsonRPC, { frontendEndpoints } from '../core/communication/rpcCommunication';
import Zoom from '../components/Zoom.vue';
import Return from '../components/Return.vue';

export default defineComponent({
    extends: EditorComponent,
    components: {
        CustomNode,
        PipelineManagerConnection,
        TemporaryConnection,
        NodePalette,
        RectangleSelection,
        Zoom,
        Return,
    },
    emits: ['setLoad'],
    setup(props, { emit }) {
        const {
            el,
            counter,
            nodes,
            connections,
            selectedNodes,
            nodeContainerStyle,
            keyDown,
            keyUp,
        } = EditorComponent.setup(props);

        const connRefs = ref([]);
        const { graph } = useGraph();

        const panZoom = usePanZoom();
        const temporaryConnection = useTemporaryConnection();
        const editorManager = EditorManager.getEditorManagerInstance();

        const highlightConnections = ref([]);
        const highlightInterfaces = ref([]);

        const readonly = computed(() => props.viewModel.editor.readonly);
        const hideHud = computed(() => props.viewModel.editor.hideHud);

        const rectangleSelection = ref(null);
        const selectedNodesCtrlBackup = [];
        const scale = computed(() => graph.value.scaling);

        const searchQuery = computed(() => props.viewModel.editor.searchQuery);
        const greyedOutNodes = ref([]);

        let pressStartTime = 0;
        const longPressMilisThreshold = 100;

        const editorStyle = computed(() => ({
            '--scale': scale.value,
            cursor: panZoom.dragging.value ? 'move' : 'default',
        }));

        const isInSubgraph = computed(() => props.viewModel.editor.isInSubgraph());

        const preview = computed(() => props.viewModel.editor.preview);

        const unselectAllNodes = () => {
            /* eslint-disable vue/no-mutating-props,no-param-reassign */
            props.viewModel.displayedGraph.selectedNodes = [];
        };

        const appendSelectMultipleNodes = () => {
            graph.value.nodes.forEach((node) => {
                if (graph.value.selectedNodes.includes(node)) {
                    return;
                }

                const selectionBoundingRect = rectangleSelection.value.boundingRect;

                if (nodeInsideSelection(graph.value, node, selectionBoundingRect)) {
                    graph.value.selectedNodes.push(node);
                }
            });
        };

        const selectNode = (node, event) => {
            // If select was triggered by event check if CTRL is pressed,
            // otherwise use default method
            if ((event && !(event.ctrlKey)) || (!event && !props.viewModel.commandHandler.pressedKeys.includes('Control'))) {
                unselectAllNodes();
            }

            props.viewModel.displayedGraph.selectedNodes.push(node);
        };

        const selectMultipleNodes = () => {
            graph.value.selectedNodes = [];
            graph.value.nodes.forEach((node) => {
                const selectionBoundingRect = rectangleSelection.value.boundingRect;

                if (nodeInsideSelection(graph.value, node, selectionBoundingRect)) {
                    graph.value.selectedNodes.push(node);
                }
            });
        };

        let pointersDown = 0;
        const onPointerDown = (ev) => {
            pointersDown += 1;
            if (ev.target === el.value) {
                panZoom.onPointerDown(ev);
            }
            temporaryConnection.onMouseDown(ev);

            pressStartTime = new Date();
        };

        const onRightPointerDown = (ev) => {
            if (ev.target === el.value) {
                unselectAllNodes();
                rectangleSelection.value.onPointerDown(ev);
            }

            pressStartTime = new Date();
        };

        const onPointerMove = (ev) => {
            panZoom.onPointerMove(ev);
            temporaryConnection.onMouseMove(ev);
            rectangleSelection.value.onPointerMove(ev);
            if (rectangleSelection.value.selecting) {
                selectMultipleNodes();
            }
        };

        const onPointerUp = (ev) => {
            panZoom.onPointerUp(ev);
            temporaryConnection.onMouseUp();

            // handle press & hold
            const currentTime = new Date();
            const elapsedTime = currentTime - pressStartTime;
            if (elapsedTime < longPressMilisThreshold
                && ev.target === el.value) {
                unselectAllNodes();
            }

            if (pointersDown === 1) {
                document.removeEventListener('pointerup', onPointerUp);
                document.removeEventListener('pointermove', onPointerMove);
            }
            pointersDown -= 1;
        };

        const onRightPointerUp = (ev) => {
            // handle press & hold right mouse button
            const currentTime = new Date();
            const elapsedTime = currentTime - pressStartTime;
            if (elapsedTime >= longPressMilisThreshold
                && ev.target === el.value) {
                appendSelectMultipleNodes();
            }
            rectangleSelection.value.onPointerUp();

            document.removeEventListener('pointerup', onRightPointerUp);
            document.removeEventListener('pointermove', onPointerMove);
        };

        const onRightPointerDownCtrl = (ev) => {
            rectangleSelection.value.onPointerDown(ev);
            selectedNodesCtrlBackup.value = graph.value.selectedNodes;
        };

        const onRightPointerUpCtrl = () => {
            graph.value.selectedNodes = selectedNodesCtrlBackup.value;
            appendSelectMultipleNodes();
            rectangleSelection.value.onPointerUp();

            document.removeEventListener('pointerup', onRightPointerUpCtrl);
            document.removeEventListener('pointermove', onPointerMove);
        };

        document.addEventListener('pointerdown', (ev) => {
            // Dragging
            if (ev.button === 0 && !ev.shiftKey) {
                onPointerDown(ev);
                document.addEventListener('pointerup', onPointerUp);
                document.addEventListener('pointermove', onPointerMove);
            }

            // Rectangle selection
            if (readonly.value) {
                return;
            }
            if (ev.button === 2 && ev.ctrlKey) {
                onRightPointerDownCtrl(ev);
                document.addEventListener('pointerup', onRightPointerUpCtrl);
                document.addEventListener('pointermove', onPointerMove);
            } else if (ev.button === 2) {
                onRightPointerDown(ev);
                document.addEventListener('pointerup', onRightPointerUp);
                document.addEventListener('pointermove', onPointerMove);
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
                if (layer.nodeLayers && ignoredLayers.value.has(layer.name)) {
                    layer.nodeLayers.forEach(temp.add, temp);
                }
            });
            return temp;
        });

        const visibleNodes = computed(() =>
            nodes.value.filter((n) => !ignoredNodesTypes.value.has(n.layer)),
        );
        const ignoredNodes = computed(() =>
            nodes.value.filter((n) => ignoredNodesTypes.value.has(n.layer)),
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

        const highlightedNodes = computed(() =>
            visibleNodes.value.filter(
                (n) => props.viewModel.displayedGraph.selectedNodes.includes(n),
            ),
        );

        const externalApplicationManager = getExternalApplicationManager();
        if (externalApplicationManager.backendAvailable) {
            watch(visibleNodes, async (value, old) => {
                if (!editorManager.notifyWhenChanged) return;
                const newIds = Object.values(value).map((n) => n.id);
                const oldIds = Object.values(old).map((n) => n.id);
                const nodesAdded = [];
                Object.values(value).forEach((node) => {
                    if (!(oldIds.includes(node.id))) {
                        nodesAdded.push(node.save());
                    }
                });
                const nodesDeleted = [];
                Object.values(old).forEach((node) => {
                    if (!(newIds.includes(node.id))) {
                        nodesDeleted.push(node.id);
                    }
                });
                const data = {
                    graph_id: graph.value.id,
                    nodes: {
                        added: nodesAdded,
                        deleted: nodesDeleted,
                    },
                };
                await externalApplicationManager.notifyAboutChange('nodes_on_change', data);
            });

            watch(visibleConnections, async (value, old) => {
                if (!editorManager.notifyWhenChanged) return;
                const newIds = Object.values(value).map((n) => n.id);
                const oldIds = Object.values(old).map((n) => n.id);
                const connectionsAdded = [];
                Object.values(value).forEach((connection) => {
                    if (!(oldIds.includes(connection.id))) {
                        connectionsAdded.push({
                            id: connection.id,
                            from: connection.from.id,
                            to: connection.to.id,
                        });
                    }
                });
                const connectionsDeleted = [];
                Object.values(old).forEach((connection) => {
                    if (!(newIds.includes(connection.id))) {
                        connectionsDeleted.push({
                            from: connection.from.id,
                            to: connection.to.id,
                        });
                    }
                });
                const data = {
                    graph_id: graph.value.id,
                    connections: {
                        added: connectionsAdded,
                        deleted: connectionsDeleted,
                    },
                };
                await externalApplicationManager.notifyAboutChange('connections_on_change', data);
            });

            watch(highlightedNodes, async (value, old) => {
                if (!editorManager.notifyWhenChanged) return;
                const newIds = Object.values(value).map((n) => n.id);
                const oldIds = Object.values(old).map((n) => n.id);
                const nodesSelected = [];
                Object.values(value).forEach((node) => {
                    if (!(oldIds.includes(node.id))) {
                        nodesSelected.push(node.id);
                    }
                });
                const nodesUnselected = [];
                Object.values(old).forEach((node) => {
                    if (!(newIds.includes(node.id))) {
                        nodesUnselected.push(node.id);
                    }
                });
                const data = {
                    graph_id: graph.value.id,
                    nodes: {
                        selected: nodesSelected,
                        unselected: nodesUnselected,
                    },
                };
                await externalApplicationManager.notifyAboutChange('nodes_on_highlight', data);
            });
        }

        const filterNodes = (query) => {
            const threshold = -50;

            const matchingNodes = visibleNodes.value.filter((node) => {
                const { type } = node;

                const resultTitle = fuzzysort.single(query, node.title);
                const resultType = fuzzysort.single(query, type);

                if ((resultTitle !== null && resultTitle.score > threshold) ||
                    (resultType !== null && resultType.score > threshold)) {
                    node.highlightedTitle = fuzzysort.highlight(resultTitle, '<span>', '</span>');
                    node.highlightedType = fuzzysort.highlight(resultType, '<span>', '</span>');

                    return true;
                }
                node.highlightedTitle = node.title;
                node.highlightedType = node.type;
                return false;
            });

            return matchingNodes;
        };

        const nodeTitles = computed(() =>
            nodes.value.map((n) => n.title),
        );

        watch([searchQuery, nodeTitles], () => {
            if (searchQuery.value === undefined || searchQuery.value === '') {
                greyedOutNodes.value = [];
                visibleNodes.value.forEach((node) => {
                    node.highlightedTitle = node.title;
                    node.highlightedType = node.type;
                });
                return;
            }
            const matchingNodes = filterNodes(searchQuery.value);

            const nonMatchingNodes = visibleNodes.value.filter(
                (node) => !matchingNodes.includes(node),
            );

            greyedOutNodes.value = nonMatchingNodes;
        });

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
        async function updateEditorSpecification(specification) {
            let errors = EditorManager.validateSpecification(specification);
            let warnings;
            let info;

            if (errors.length) {
                NotificationHandler.terminalLog('error', 'Specification is invalid', errors);
                if (editorManager.specificationVersion !== specification.version) {
                    NotificationHandler.terminalLog(
                        'error',
                        'Mismatched specification version',
                        `Specification version (${specification.version}) differs from the current version (${editorManager.specificationVersion}). It may result in unexpected behaviour.` +
                        ' Please refer to https://antmicro.github.io/kenning-pipeline-manager/changelogs.html to see if that is the case.',
                    );
                }
                return errors;
            }

            ({ errors, warnings, info } = await editorManager.updateEditorSpecification(specification)); // eslint-disable-line prefer-const,max-len
            if (Array.isArray(warnings) && warnings.length) {
                NotificationHandler.terminalLog(
                    'warning',
                    'Issue when loading specification',
                    warnings,
                );
            }
            if (Array.isArray(errors) && errors.length) {
                NotificationHandler.terminalLog('error', 'Specification is invalid', errors);
                if (Array.isArray(info) && info.length) {
                    NotificationHandler.terminalLog(
                        'error',
                        'Mismatched specification version',
                        `${info} Please refer to https://antmicro.github.io/kenning-pipeline-manager/changelogs.html to see if that is the case.`,
                    );
                }
            } else if (Array.isArray(info) && info.length) {
                NotificationHandler.terminalLog('info', 'Specification loaded', info);
            }

            return errors;
        }

        /**
         * Prepares the Editor based on dataflow configuration.
         *
         * The function loads the dataflow
         * and provides error messages for erroneous content.
         *
         * @param dataflow The object holding the parsed dataflow file
         */
        async function updateDataflow(dataflow) {
            const { errors, warnings, info } = await editorManager.loadDataflow(dataflow);

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
                if (Array.isArray(info) && info.length) {
                    NotificationHandler.terminalLog(
                        'error',
                        'Mismatched dataflow version',
                        `${info} Please refer to https://antmicro.github.io/kenning-pipeline-manager/changelogs.html to see if that is the case.`,
                    );
                }
            } else if (Array.isArray(info) && info.length) {
                NotificationHandler.terminalLog('info', 'Dataflow loaded', info);
            }

            return errors;
        }

        /* eslint-disable no-lonely-if */
        onMounted(async () => {
            // Load specification and/or dataflow delivered via window.postMessage
            window.addEventListener('message', async (event) => {
                // TODO: introduce mechanism for checking event.origin against allowed origins
                const request = {
                    jsonrpc: JSONRPC,
                    id: uuidv4(),
                    ...(event.data ?? {}),
                };

                if (!isJSONRPCRequest(request)) {
                    return;
                }

                const response = event.data.method in frontendEndpoints
                    ? (await jsonRPC.server.receive(request))
                    : (await jsonRPC.requestAdvanced(request));

                if (response) event.source.postMessage(JSON.parse(JSON.stringify(response)));
            });

            NotificationHandler.setShowNotification(false);
            editorManager.updateMetadata({}); // Defaulting metadata values

            const escapedsearch = window.location.search.replace(/&amp;/g, '&');
            const urlParams = new URLSearchParams(escapedsearch);
            if (urlParams.has('preview')) {
                const setting = urlParams.get('preview') === 'true';
                props.viewModel.editor.preview = setting;
            }

            let specText;
            // Try loading default specification and/or dataflow from URLs provided in an
            if (urlParams.has('spec')) {
                const [status, ret] = await loadJsonFromRemoteLocation(urlParams.get('spec'));
                if (status === false) {
                    NotificationHandler.terminalLog(
                        'error',
                        ret,
                    );
                    NotificationHandler.terminalLog(
                        'error',
                        `Failed to load the specification file from: ${urlParams.get('spec')}`,
                    );
                } else {
                    specText = ret;
                }
            } else if (defaultSpecification) {
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
                if (urlParams.has('include')) {
                    if (specText.include === undefined) specText.include = [];
                    specText.include.push(urlParams.get('include'));
                }
                const errors = await updateEditorSpecification(specText);

                if (errors.length) {
                    NotificationHandler.restoreShowNotification();
                    props.viewModel.editor.events.setLoad.emit(false);
                    return;
                }

                let dataflow;
                if (urlParams.has('graph')) {
                    const [status, ret] = await loadJsonFromRemoteLocation(urlParams.get('graph'));
                    if (status === false) {
                        NotificationHandler.terminalLog(
                            'error',
                            ret,
                        );
                        NotificationHandler.terminalLog(
                            'error',
                            `Failed to load the graph file from: ${urlParams.get('graph')}`,
                        );
                    } else {
                        dataflow = ret;
                    }
                } else if (defaultDataflow) {
                    dataflow = require(process.env.VUE_APP_DATAFLOW_PATH); // eslint-disable-line global-require,max-len,import/no-dynamic-require
                }
                if (dataflow) {
                    await updateDataflow(dataflow);
                }
            }
            NotificationHandler.restoreShowNotification();
            props.viewModel.editor.events.setLoad.emit(false);
        });

        const onDrop = async (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            const files = [];
            if (event.dataTransfer.items) {
                [...event.dataTransfer.items].filter(
                    (item) => item.kind === 'file',
                ).forEach(
                    (item) => files.push(item.getAsFile()),
                );
            } else {
                files.push(...event.dataTransfer.files);
            }
            if (files.length > 1) {
                NotificationHandler.showToast(
                    'warning',
                    'More than one file dropped, processing only the first one',
                );
            }
            const reader = new FileReader();
            reader.addEventListener('load', async (ev) => {
                const file = ev.target.result;
                let data;
                try {
                    data = JSON.parse(file);
                } catch (SyntaxError) {
                    NotificationHandler.showToast(
                        'error',
                        'Dropped file is not in JSON format',
                    );
                    return;
                }

                props.viewModel.editor.events.setLoad.emit(true);
                const resolve = () => props.viewModel.editor.events.setLoad.emit(false);

                if (data.nodes || data.include) { // Load Specification
                    if (externalApplicationManager.backendAvailable) {
                        NotificationHandler.showToast(
                            'warning',
                            'Specification is managed by an external application.',
                        );
                    } else {
                        await updateEditorSpecification(data);
                    }
                    resolve();
                    return;
                }

                if (data.graphs) { // Load Dataflow
                    await updateDataflow(data);
                    resolve();
                    return;
                }
                resolve();

                NotificationHandler.showToast(
                    'error',
                    'File is neither specification nor dataflow',
                );
            });
            reader.onerror = (er) => NotificationHandler.terminalLog(
                'error',
                'File cannot be loaded',
                er.message,
            );
            reader.readAsText(files[0]);
        };

        props.viewModel.editor.events.setLoad = new BaklavaEvent();
        props.viewModel.editor.events.setLoad.subscribe('editor', (value) => {
            emit('setLoad', value);
        });

        const center = () => {
            editorManager.centerZoom();
        };

        const returnFromSubgraph = () => {
            editorManager.returnFromSubgraph();
        };

        return {
            el,
            counter,
            selectedNodes,
            nodeContainerStyle,
            onRightPointerUp,
            onDrop,
            nodes,
            keyDown,
            keyUp,
            selectNode,
            rectangleSelection,
            greyedOutNodes,
            temporaryConnection: temporaryConnection.temporaryConnection,
            temporaryConnectionRender: temporaryConnection.render,
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
            editorStyle,
            zoomIn: panZoom.onZoomIn,
            zoomOut: panZoom.onZoomOut,
            center,
            returnFromSubgraph,
            isInSubgraph,
            preview,
        };
    },
});
</script>
