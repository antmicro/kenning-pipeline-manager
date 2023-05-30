/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { stringify } from 'ajv';

import { useBaklava, BaklavaInterfaceTypes, GRAPH_NODE_TYPE_PREFIX } from 'baklavajs';

import PipelineManagerEditor from '../custom/Editor';

import NotificationHandler from './notifications';
import { NodeFactory, readInterfaceTypes, SubgraphFactory } from './NodeFactory';
import specificationSchema from '../../../resources/schemas/dataflow_spec_schema.json';
import ConnectionRenderer from './ConnectionRenderer';

export default class EditorManager {
    static instance;

    editor = new PipelineManagerEditor();

    baklavaView = useBaklava(this.editor);

    nodeInterfaceTypes = new BaklavaInterfaceTypes(this.editor, {
        viewPlugin: this.baklavaView,
    });

    specificationLoaded = false;

    currentSpecification = undefined;

    interfacesStyleId = 'interfaces-style';

    constructor() {
        this.baklavaView.connectionRenderer = new ConnectionRenderer(this.baklavaView);

        // need to be set here as settings try to use this value before specification is loaded
        this.baklavaView.ignorableLayers = [];
        this.baklavaView.collapseSidebar = true;

        this.baklavaView.hooks.renderNode.subscribe("EditorManager", (node) => {
            if(node.node.type.startsWith(GRAPH_NODE_TYPE_PREFIX) ||
                node.node.type === "__baklava_SubgraphInputNode" ||
                node.node.type === "__baklava_SubgraphOutputNode"
            ) {
                Object.values(node.node.inputs).forEach(intf =>
                    intf.direction = "input"
                )
                Object.values(node.node.outputs).forEach(intf =>
                    intf.direction = "output"
                )
            }
        })
    }

    /**
     * Loads the dataflow specification passed in `dataflowSpecification`.
     * The specification describes what nodes are available in the editor.
     *
     * If the current editor already has a specification loaded then the editor
     * and its plugins are reinitialized and then the specification is loaded.
     *
     * @param dataflowSpecification Specification to load
     * @param overriding tells whether the specification is updated on dataflow loading
     */
    /* eslint-disable no-underscore-dangle */
    updateEditorSpecification(dataflowSpecification, overriding = false) {
        if (!dataflowSpecification) return;
        if (this.specificationLoaded) {
            this.cleanEditor();
        }

        const { subgraphs, nodes, metadata } = dataflowSpecification;

        const interfaceTypes = readInterfaceTypes(nodes, metadata);
        this.nodeInterfaceTypes.addTypes(...Object.values(interfaceTypes));
        this.updateInterfacesStyle(metadata);

        if ('urls' in metadata) {
            Object.entries(metadata.urls).forEach(([urlName, state]) => {
                this.editor.baseURLs.set(urlName, state);
            });
        }

        nodes.forEach((node) => {
            const myNode = NodeFactory(
                node.name,
                node.name,
                node.type,
                node.interfaces,
                node.properties,
                interfaceTypes,
                'twoColumn' in metadata ? metadata.twoColumn : false,
            );
            this.editor.registerNodeType(myNode, { title: node.name, category: node.category });
            if ('icon' in node) {
                this.editor.nodeIcons.set(node.name, node.icon);
            }
            if ('urls' in node) {
                Object.entries(node.urls).forEach(([urlName, url]) => {
                    if (!this.editor.nodeURLs.has(node.name)) {
                        this.editor.nodeURLs.set(node.name, {});
                    }
                    this.editor.nodeURLs.get(node.name)[urlName] = url;
                });
            }
        });

        subgraphs.forEach((subgraph) => {
            const mySubgraph = SubgraphFactory(
                subgraph.nodes,
                subgraph.connections,
                subgraph.interfaces,
                subgraph.name,
                subgraph.type,
                this.editor
            );
            this.editor.addGraphTemplate(mySubgraph, subgraph.category, subgraph.type);
        });
        this.editor.readonly = metadata.readonly ?? false;
        this.editor.hideHud = metadata.hideHud ?? false;
        NotificationHandler.setShowOption(!this.editor.hideHud);
        if (this.editor.readonly) {
            NotificationHandler.showToast(
                'info',
                'The specification is read-only. Only dataflow loading is allowed.',
            );
        }
        this.editor.allowLoopbacks = metadata.allowLoopbacks ?? false;
        if ('connectionStyle' in metadata) {
            this.baklavaView.connectionRenderer.style = metadata.connectionStyle;
        }

        this.baklavaView.ignoredLayers = new Set();
        this.baklavaView.ignorableLayers = metadata.layers ?? [];
        this.baklavaView.collapseSidebar = metadata.collapseSidebar ?? true;

        this.specificationLoaded = true;
    }

    /**
     * Removes interfaces stylesheet registered using id `interfacesStyleId`.
     * It is used to cleanup the editor enviornment when chaning a specification.
     */
    removeInterfacesStyle() {
        const styleSheet = document.getElementById(this.interfacesStyleId);
        if (styleSheet !== null) {
            document.head.removeChild(styleSheet);
        }
    }

    /**
     * Updates global stylesheet with coloring specified in the metadata argument.
     * The stylesheet is registered with id `interfacesStyleId`.
     *
     * @param metadata metadata of the specification
     */
    updateInterfacesStyle(metadata) {
        if ('interfaces' in metadata) {
            const styleSheet = document.createElement('style');
            let styles = '';

            Object.entries(metadata.interfaces).forEach(([name, data]) => {
                styles += `.baklava-node-interface[data-interface-type="${name}"] .__port { background-color: ${data.interfaceColor}; }`;
            });

            styleSheet.innerText = styles;
            styleSheet.type = 'text/css';
            styleSheet.id = this.interfacesStyleId;

            document.head.appendChild(styleSheet);
        }
    }

    /**
     * Cleans up the editor.
     *
     * Removes all nodes and connections from the editor and unregisters all
     * nodes. Its important that registered interface types are not removed, as there
     * is no support for that in baklavajs, but it should not result in any malfunction.
     */
    cleanEditor() {
        const graphInstance = this.editor._graph;

        for (let i = graphInstance.connections.length - 1; i >= 0; i -= 1) {
            graphInstance.removeConnection(graphInstance.connections[i]);
        }
        for (let i = graphInstance.nodes.length - 1; i >= 0; i -= 1) {
            graphInstance.removeNode(graphInstance.nodes[i]);
        }

        this.editor.nodeTypes.forEach((_, nodeKey) => {
            this.editor.unregisterNodeType(nodeKey);
        });

        this.removeInterfacesStyle();
    }

    /**
     * Serializes and returns current dataflow in Pipeline Manager format.
     *
     * @returns Serialized dataflow.
     */
    saveDataflow() {
        return this.editor.save();
    }

    /**
     * Loads the dataflow passed in `dataflow` and renders it.
     * If the dataflow is not compatible with the currently loaded specification or is not
     * in the dataflow format, then some of the dataflow may be not loaded and an
     * error is returned. Dataflow should be passed in PipelineManager format (translation
     * to Baklava format is done )
     *
     * @param dataflow Dataflow to load
     * @returns An array of errors that occured during the dataflow loading.
     * If the array is empty, the loading was successful.
     */
    loadDataflow(dataflow) {
        this.editor.view = this.baklavaView;
        try {
            if ('metadata' in dataflow && this.currentSpecification !== undefined) {
                const errors = this.validateMetadata(dataflow.metadata);
                if (Array.isArray(errors) && errors.length) {
                    return errors;
                }
                const updatedspecification = JSON.parse(JSON.stringify(this.currentSpecification));
                if ('metadata' in updatedspecification) {
                    Object.entries(dataflow.metadata).forEach(([key, value]) => {
                        if (Array.isArray(value)) {
                            updatedspecification.metadata[key] = [
                                ...updatedspecification.metadata[key],
                                ...value,
                            ];
                        } else if (typeof value === 'object') {
                            updatedspecification.metadata[key] = {
                                ...updatedspecification.metadata[key],
                                ...value,
                            };
                        } else {
                            updatedspecification.metadata[key] = value;
                        }
                    });
                } else {
                    updatedspecification.metadata = dataflow.metadata;
                }

                this.updateEditorSpecification(updatedspecification, true);
            } else {
                this.updateEditorSpecification(this.currentSpecification);
            }
            return this.editor.load(dataflow);
        } catch (err) {
            return [
                'Unrecognized format. Make sure that the passed dataflow is correct.',
                err.toString(),
            ];
        }
    }

    /**
     * Static function used to get the instance of the EditorManager in a singleton manner.
     * If there is no existing instance of the EditorManager then a new one is created.
     *
     * @returns Instance of EditorManager.
     */
    static getEditorManagerInstance() {
        if (!EditorManager.instance) {
            EditorManager.instance = new EditorManager();
        }
        return EditorManager.instance;
    }

    /**
     * Validates JSON data using given JSON schema
     *
     * @param data JSON file to validate
     * @param schema Schema to use
     * @returns An array of errors. If the array is empty, the validation was successful.
     */
    /* eslint-disable class-methods-use-this */
    validateJSONWithSchema(data, schema) {
        const ajv = new Ajv();

        const validate = ajv.compile(schema);
        const valid = validate(data);
        if (valid) {
            return [];
        }

        // Parsing errors messages to a human readable string
        const errors = validate.errors.map((error) => {
            const path = `specification${error.instancePath}`;
            switch (error.keyword) {
                case 'enum':
                    return `${path} ${error.message} - ${stringify(error.params.allowedValues)}`;
                default:
                    return `${path} ${error.message}`;
            }
        });
        return errors;
    }

    /**
     * Validates specification passed in `specification` using jsonSchema.
     *
     * @param specification Specification to validate
     * @returns An array of errors. If the array is empty, the validation was successful.
     */
    /* eslint-disable class-methods-use-this */
    validateSpecification(specification) {
        return this.validateJSONWithSchema(specification, specificationSchema);
    }

    /**
     * Validates metadata in JSON format using schema from specificationSchema.
     *
     * @param jsonmetadata metadata in JSON format to validate
     * @return An array of errors. If the array is empty, the validation was successful.
     */
    validateMetadata(jsonmetadata) {
        return this.validateJSONWithSchema(jsonmetadata, specificationSchema.properties.metadata);
    }

    isInsideSubgraph() {
        return this.baklavaView.displayedGraph !== this.editor.graph
    }

    returnFromSubgraph() {
        this.editor.switchToMainGraph(this.baklavaView.displayedGraph);
    }
}
