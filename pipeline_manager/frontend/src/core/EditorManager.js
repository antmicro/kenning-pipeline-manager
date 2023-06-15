/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { stringify } from 'ajv';

import { useBaklava, BaklavaInterfaceTypes } from 'baklavajs';

import PipelineManagerEditor from '../custom/Editor';

import NotificationHandler from './notifications';
import { NodeFactory, readInterfaceTypes, SubgraphFactory } from './NodeFactory';
import unresolvedSpecificationSchema from '../../../resources/schemas/unresolved_specification_schema.json';
import specificationSchema from '../../../resources/schemas/specification_schema.json';
import ConnectionRenderer from './ConnectionRenderer';
import {
    SubgraphInoutNode,
    SubgraphInputNode,
    SubgraphOutputNode,
} from '../custom/subgraphInterface';

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

        // need to be set here as settings try to use this value
        // before this value can be loaded from specification
        this.baklavaView.ignorableLayers = [];
        this.baklavaView.collapseSidebar = true;
        this.specificationVersion = specificationSchema.version;
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
     * @param resolve determines whether resolving of inheritance is needed
     * @returns An array of errors. If the array is empty, the updating process was successful.
     */
    /* eslint-disable no-underscore-dangle */
    updateEditorSpecification(dataflowSpecification, overriding = false, resolve = true) {
        if (!dataflowSpecification) return ['No specification passed'];
        if (this.specificationLoaded) {
            this.cleanEditor();
        }

        const { subgraphs, nodes, metadata, version } = dataflowSpecification; // eslint-disable-line object-curly-newline,max-len
        if (overriding || !this.currentSpecification) {
            if (version === undefined) {
                NotificationHandler.terminalLog(
                    'warning',
                    'Specification has no version assigned',
                    `Loaded specification has no version assigned. Please update the specification to version ${this.specificationVersion}.`,
                );
            } else if (version !== this.specificationVersion) {
                NotificationHandler.terminalLog(
                    'warning',
                    'Incompatible specification version',
                    `The specification format version (${version}) differs from the current specification format version (${this.specificationVersion}). It may result in an unexpected behaviour.`,
                );
            }
        }

        if (!overriding) {
            this.currentSpecification = JSON.parse(JSON.stringify(dataflowSpecification));
        }

        let resolvedNodes = [];

        if (resolve) {
            try {
                resolvedNodes = this.resolveInheritance(nodes);
            } catch (e) {
                return [e];
            }
        }

        const errors = this.validateSpecification(
            { subgraphs, nodes: resolvedNodes, metadata },
            specificationSchema,
        );
        if (Array.isArray(errors) && errors.length) {
            return errors;
        }

        const interfaceTypes = readInterfaceTypes(resolvedNodes, metadata);
        this.nodeInterfaceTypes.addTypes(...Object.values(interfaceTypes));
        this.updateInterfacesStyle(metadata);

        if ('urls' in metadata) {
            Object.entries(metadata.urls).forEach(([urlName, state]) => {
                this.editor.baseURLs.set(urlName, state);
            });
        }

        this.editor.registerNodeType(SubgraphInputNode, { category: 'Subgraphs' });
        this.editor.registerNodeType(SubgraphOutputNode, { category: 'Subgraphs' });
        this.editor.registerNodeType(SubgraphInoutNode, { category: 'Subgraphs' });

        resolvedNodes.forEach((node) => {
            const myNode = NodeFactory(
                node.name,
                node.name,
                node.type,
                node.interfaces,
                node.properties,
                interfaceTypes,
                metadata && 'twoColumn' in metadata ? metadata.twoColumn : false,
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

        if (subgraphs !== undefined) {
            subgraphs.forEach((subgraph) => {
                const mySubgraph = SubgraphFactory(
                    subgraph.nodes,
                    subgraph.connections,
                    subgraph.interfaces,
                    subgraph.name,
                    subgraph.type,
                    this.editor,
                );
                this.editor.addGraphTemplate(mySubgraph, subgraph.category, subgraph.type);
            });
        }

        this.editor.readonly = (metadata && metadata.readonly) ?? false;
        this.editor.hideHud = (metadata && metadata.hideHud) ?? false;

        NotificationHandler.setShowOption(!this.editor.hideHud);
        if (this.editor.readonly) {
            NotificationHandler.showToast(
                'info',
                'The specification is read-only. Only dataflow loading is allowed.',
            );
        }
        this.editor.allowLoopbacks = (metadata && metadata.allowLoopbacks) ?? false;
        if (metadata && 'connectionStyle' in metadata) {
            this.baklavaView.connectionRenderer.style = metadata.connectionStyle;
        }

        this.baklavaView.ignoredLayers = new Set();
        this.baklavaView.ignorableLayers = metadata.layers ?? [];
        this.baklavaView.collapseSidebar = metadata.collapseSidebar ?? true;

        this.specificationLoaded = true;
        return [];
    }

    /**
     * Given nodes resolves their inheritances and returns and array of nodes that are ready
     * to be loaded by the editor.
     *
     * @param nodes
     * @returns nodes with resolved inheritances
     */
    /* eslint-disable class-methods-use-this,no-param-reassign */
    resolveInheritance(nodes) {
        const unsortedNodes = JSON.parse(JSON.stringify(nodes));

        const isObject = (obj) => typeof obj === 'object' && obj !== null && !Array.isArray(obj);
        const isArray = (obj) => Array.isArray(obj);

        // Helper function that applies base node properties to the child node
        const mergeNodes = (child, base) => {
            const output = { ...child };
            if (isObject(child) && isObject(base)) {
                Object.keys(base).forEach((key) => {
                    if (isObject(base[key])) {
                        if (!(key in child)) {
                            output[key] = base[key];
                        } else {
                            output[key] = mergeNodes(child[key], base[key]);
                        }
                    } else if (isArray(child[key]) && isArray(base[key])) {
                        if (key === 'extends') {
                            output[key] = child[key];
                        } else {
                            output[key] = [...child[key], ...base[key]];
                        }
                    } else {
                        output[key] = base[key];
                    }
                });
            }
            return output;
        };

        // Topological sort
        const sortedNodes = [];

        let lastLength = unsortedNodes.length;
        while (unsortedNodes.length !== 0) {
            const toResolve = [...unsortedNodes];

            toResolve.forEach((node) => {
                if (node.extends === undefined || node.extends.length === 0) {
                    const index = unsortedNodes.indexOf(node);
                    unsortedNodes.splice(index, 1);

                    sortedNodes.push(node.name);
                }
            });

            unsortedNodes.forEach((node) => {
                const notResolvedExtends = [];
                const toResolveExtends = [...node.extends];

                toResolveExtends.forEach((name) => {
                    const found = sortedNodes.find((resolved) => resolved === name);
                    if (found !== undefined) {
                        const index = node.extends.indexOf(name);
                        node.extends.splice(index, 1);
                    } else {
                        notResolvedExtends.push(name);
                    }
                });

                node.extends = notResolvedExtends;
            });

            if (lastLength === unsortedNodes.length) {
                throw new Error('Unresorvable inheritance in specification!');
            }
            lastLength = unsortedNodes.length;
        }

        const resolvedNodes = [];
        // DFS resolving inheritance
        sortedNodes.forEach((name) => {
            const node = JSON.parse(JSON.stringify(nodes.find((n) => n.name === name)));
            const visited = [];

            // Reversing so that pop starts from the first element
            let toVisit = node.extends ? [...node.extends.reverse()] : [];

            while (toVisit.length !== 0) {
                const visitedNodeName = toVisit.pop();
                if (!visited.includes(visitedNodeName)) {
                    visited.push(visitedNodeName);

                    const visitedNode = nodes.find((n) => n.name === visitedNodeName);

                    if (visitedNode.extends !== undefined) {
                        toVisit = [...toVisit, ...visitedNode.extends];
                    }

                    const nodeName = node.name;
                    Object.assign(node, mergeNodes(node, visitedNode));
                    node.name = nodeName;
                }
            }
            resolvedNodes.push(node);
        });

        return resolvedNodes;
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
        if (metadata && 'interfaces' in metadata) {
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
        const save = this.editor.save();
        save.version = this.specificationVersion;
        return save;
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
            const specificationVersion = dataflow.version;
            if (specificationVersion === undefined) {
                NotificationHandler.terminalLog(
                    'warning',
                    'Dataflow has no format version assigned.',
                    `Current format specification version is ${this.specificationVersion}. It may result in an unexpected behaviour`,
                );
            } else if (specificationVersion !== this.specificationVersion) {
                NotificationHandler.terminalLog(
                    'warning',
                    'Incompatible dataflow format',
                    `Dataflow format specification version (${specificationVersion}) differs from the current format specification version (${this.specificationVersion}). It may result in unexpected behaviour.`,
                );
            }

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

                this.updateEditorSpecification(updatedspecification, true, false);
            } else {
                this.updateEditorSpecification(this.currentSpecification, false);
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
        ajv.addKeyword('version');

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
    validateSpecification(specification, schema = unresolvedSpecificationSchema) {
        return this.validateJSONWithSchema(specification, schema);
    }

    /**
     * Validates metadata in JSON format using schema from unresolvedSpecificationSchema.
     *
     * @param jsonmetadata metadata in JSON format to validate
     * @return An array of errors. If the array is empty, the validation was successful.
     */
    validateMetadata(jsonmetadata) {
        return this.validateJSONWithSchema(
            jsonmetadata,
            unresolvedSpecificationSchema.properties.metadata,
        );
    }

    /**
     * Checks whether currently edited pipeline is one of the subgraphs
     *
     * @returns True if editor is editing subgraph instance, false otherwise
     */
    isInsideSubgraph() {
        return this.baklavaView.displayedGraph !== this.editor.graph;
    }

    /**
     * Switches the editor state to main graph
     */
    returnFromSubgraph() {
        this.editor.backFromSubgraph(this.baklavaView.displayedGraph);
    }
}
