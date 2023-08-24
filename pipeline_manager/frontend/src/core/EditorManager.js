/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable max-classes-per-file */
import { stringify } from 'ajv';
import Ajv2019 from 'ajv/dist/2019.js';
import jsonMap from 'json-source-map';
import jsonlint from 'jsonlint';

import { useBaklava, useCommandHandler } from '@baklavajs/renderer-vue';
import { toRaw, ref } from 'vue';
import { useHistory } from './History.ts';
import { useClipboard } from './Clipboard.ts';

import PipelineManagerEditor from '../custom/Editor.js';
import InterfaceTypes from './InterfaceTypes.js';

import { NodeFactory, SubgraphFactory } from './NodeFactory.js';
import unresolvedSpecificationSchema from '../../../resources/schemas/unresolved_specification_schema.json' assert { type: 'json' };
import specificationSchema from '../../../resources/schemas/specification_schema.json' assert { type: 'json' };
import metadataSchema from '../../../resources/schemas/metadata_schema.json' assert { type: 'json' };
import dataflowSchema from '../../../resources/schemas/dataflow_schema.json' assert { type: 'json' };
import graphSchema from '../../../resources/schemas/graph_schema.json' assert { type: 'json' };
import ConnectionRenderer from './ConnectionRenderer.js';
import {
    SubgraphInoutNode,
    SubgraphInputNode,
    SubgraphOutputNode,
} from '../custom/subgraphInterface.js';

/* eslint-disable lines-between-class-members */
/**
 * Readonly helper class that reads and stores default values from metadata schema.
 */
class Metadata {
    constructor() {
        Object.entries(metadataSchema.properties).forEach(([name, state]) => {
            this[name] = state.default;
        });
    }
}

export default class EditorManager {
    static instance;

    defaultMetadata = new Metadata();

    editor = new PipelineManagerEditor();

    baklavaView = useBaklava(this.editor);

    specificationLoaded = false;

    currentSpecification = undefined;

    constructor() {
        this.baklavaView.connectionRenderer = new ConnectionRenderer(
            this.baklavaView,
            this.defaultMetadata.connectionStyle,
            this.defaultMetadata.randomizedOffset,
        );

        this.baklavaView.editor.layoutManager.useAlgorithm(this.defaultMetadata.layout);
        this.baklavaView.interfaceTypes = new InterfaceTypes(this.baklavaView);

        // need to be set here as settings try to use this value
        // before this value can be loaded from specification
        this.baklavaView.layers = this.defaultMetadata.layers;
        this.baklavaView.collapseSidebar = this.defaultMetadata.collapseSidebar;
        this.baklavaView.movementStep = this.defaultMetadata.movementStep;
        this.baklavaView.editor.allowLoopbacks = this.defaultMetadata.allowLoopbacks;
        this.baklavaView.cache = {};

        // hideHud and readonly are set to true so that there is no dissappearning UI
        this.baklavaView.hideHud = true;
        this.baklavaView.editor.readonly = true;

        this.specificationVersion = unresolvedSpecificationSchema.version;
        this.baklavaView.commandHandler = useCommandHandler();
        this.baklavaView.history = null;
        this.baklavaView.history = useHistory(
            toRaw(this.baklavaView).displayedGraph,
            this.baklavaView.commandHandler,
        );
        this.baklavaView.clipboard = useClipboard(
            toRaw(this.baklavaView).displayedGraph,
            ref(this.baklavaView.editor),
            this.baklavaView.commandHandler,
        );
    }

    /**
     * Loads the dataflow specification passed in `dataflowSpecification`.
     * The specification describes what nodes are available in the editor.
     *
     * If the current editor already has a specification loaded then the editor
     * and its plugins are reinitialized and then the specification is loaded.
     *
     * @param dataflowSpecification Specification to load, can be either an object or a string
     * @param lazyLoad Decides wether to actually load the specification or just store
     * it and check its versioning. Can be used when loading parts of specification manually.
     * @returns An object consisting of errors and warnings arrays. If any array is empty
     * the updating process was successful.
     */
    /* eslint-disable no-underscore-dangle,no-param-reassign */
    updateEditorSpecification(dataflowSpecification, lazyLoad = false) {
        if (!dataflowSpecification) return ['No specification passed'];

        if (typeof dataflowSpecification === 'string' || dataflowSpecification instanceof String) {
            dataflowSpecification = jsonlint.parse(dataflowSpecification);
        }

        if (this.specificationLoaded) {
            this.baklavaView.editor.unregisterGraphs();
            this.baklavaView.editor.cleanEditor();
            this.baklavaView.editor.unregisterNodes();
        }

        const warnings = [];
        const errors = [];
        const { metadata, version } = dataflowSpecification; // eslint-disable-line object-curly-newline,max-len
        if (!this.currentSpecification) {
            if (version === undefined) {
                warnings.push(
                    `Loaded specification has no version assigned. Please update the specification to version ${this.specificationVersion}.`,
                );
            } else if (version !== this.specificationVersion) {
                warnings.push(
                    `The specification format version (${version}) differs from the current specification format version (${this.specificationVersion}). It may result in an unexpected behaviour.`,
                );
            }
        }

        this.currentSpecification = dataflowSpecification;
        if (!lazyLoad) {
            errors.push(...this.updateMetadata(metadata));
            errors.push(...this.updateGraphSpecification(dataflowSpecification));
        }

        if (!errors.length) {
            this.specificationLoaded = true;
        }
        return { errors, warnings };
    }

    /**
     * Reads and validates part of specification related to nodes and subgraphs
     * @param dataflowSpecification Specification to load
     * @returns An object consisting of errors and warnings arrays. If any array is empty
     * the updating process was successful.
     */
    updateGraphSpecification(dataflowSpecification = undefined) {
        if (dataflowSpecification === undefined) {
            dataflowSpecification = this.currentSpecification;
        }

        if (!dataflowSpecification) return ['No specification to load provided.'];

        const { subgraphs, nodes, metadata } = dataflowSpecification; // eslint-disable-line object-curly-newline,max-len

        let resolvedNodes = [];

        try {
            resolvedNodes = this.resolveInheritance(nodes);
        } catch (e) {
            return [e];
        }

        let errors = this.validateSpecification(
            { subgraphs, nodes: resolvedNodes, metadata },
            specificationSchema,
        );
        if (Array.isArray(errors) && errors.length) {
            return errors;
        }

        this.baklavaView.editor.registerNodeType(SubgraphInputNode, { category: 'Subgraphs' });
        this.baklavaView.editor.registerNodeType(SubgraphOutputNode, { category: 'Subgraphs' });
        this.baklavaView.editor.registerNodeType(SubgraphInoutNode, { category: 'Subgraphs' });

        errors = [];
        resolvedNodes.forEach((node) => {
            const myNode = NodeFactory(
                node.name,
                node.name,
                node.type,
                node.interfaces,
                node.properties,
                node.interfaceGroups ?? [],
                node.defaultInterfaceGroups ?? [],
                metadata?.twoColumn ?? false,
                node.description ?? '',
            );

            // If my node is any array then it is an array of errors
            if (Array.isArray(myNode) && myNode.length) {
                errors.push(...myNode);
                return;
            }

            this.baklavaView.editor.registerNodeType(myNode, {
                title: node.name,
                category: node.category,
            });
            if ('icon' in node) {
                this.baklavaView.editor.nodeIcons.set(node.name, node.icon);
            }
            if ('urls' in node) {
                Object.entries(node.urls).forEach(([urlName, url]) => {
                    if (!this.baklavaView.editor.nodeURLs.has(node.name)) {
                        this.baklavaView.editor.nodeURLs.set(node.name, {});
                    }
                    this.baklavaView.editor.nodeURLs.get(node.name)[urlName] = url;
                });
            }
        });

        if (errors.length) {
            return errors;
        }

        if (subgraphs !== undefined) {
            subgraphs.forEach((subgraph) => {
                const mySubgraph = SubgraphFactory(
                    subgraph.nodes,
                    subgraph.connections,
                    subgraph.interfaces,
                    subgraph.name,
                    subgraph.type,
                    this.baklavaView.editor,
                );

                // If my subgraph is any array then it is an array of errors
                if (Array.isArray(mySubgraph) && mySubgraph.length) {
                    errors.push(...mySubgraph);
                    return;
                }

                this.baklavaView.editor.addGraphTemplate(
                    mySubgraph,
                    subgraph.category,
                    subgraph.type,
                );
            });
        }

        if (errors.length) {
            return errors;
        }

        return [];
    }

    /**
     * Reads and validates metadata from specification and loads it into the editor.
     * if no metadata is passed it uses a stored specification.
     *
     * @param metadata metadata to load
     * @param overriding tells whether the metadata is updated on dataflow loading
     *
     */
    updateMetadata(metadata = undefined, overriding = false) {
        if (metadata === undefined && this.currentSpecification) {
            metadata = this.currentSpecification.metadata ?? {};
        }

        if (!metadata) return ['No specification to load provided.'];

        if (overriding) {
            const updatedMetadata = JSON.parse(
                JSON.stringify(this.currentSpecification.metadata ?? {}),
            );

            Object.entries(metadata).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    updatedMetadata[key] = [...updatedMetadata[key], ...value];
                } else if (typeof value === 'object') {
                    updatedMetadata[key] = {
                        ...updatedMetadata[key],
                        ...value,
                    };
                } else {
                    updatedMetadata[key] = value;
                }
            });

            metadata = updatedMetadata;
        }

        this.baklavaView.interfaceTypes.readInterfaceTypes(metadata);

        if (metadata && 'urls' in metadata) {
            Object.entries(metadata.urls).forEach(([urlName, state]) => {
                this.baklavaView.editor.baseURLs.set(urlName, state);
            });
        }

        this.baklavaView.editor.readonly = metadata?.readonly ?? this.defaultMetadata.readonly;
        this.baklavaView.hideHud = metadata?.hideHud ?? this.defaultMetadata.hideHud;

        this.editor.allowLoopbacks =
            metadata?.allowLoopbacks ?? this.defaultMetadata.allowLoopbacks;
        this.baklavaView.twoColumn = metadata?.twoColumn ?? this.defaultMetadata.twoColumn;
        this.baklavaView.connectionRenderer.style =
            metadata?.connectionStyle ?? this.defaultMetadata.connectionStyle;

        this.baklavaView.movementStep = metadata?.movementStep ?? this.defaultMetadata.movementStep;
        this.baklavaView.settings.background.gridSize =
            metadata?.backgroundSize ?? this.defaultMetadata.backgroundSize;
        this.baklavaView.connectionRenderer.randomizedOffset =
            metadata?.randomizedOffset ?? this.defaultMetadata.randomizedOffset;

        this.baklavaView.ignoredLayers = new Set();
        this.baklavaView.layers = metadata?.layers ?? this.defaultMetadata.layers;
        this.baklavaView.collapseSidebar =
            metadata?.collapseSidebar ?? this.defaultMetadata.collapseSidebar;
        this.baklavaView.editor.layoutManager.useAlgorithm(
            metadata?.layout ?? this.defaultMetadata.layout,
        );

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
            const output = { ...base };
            if (isObject(child) && isObject(base)) {
                Object.keys(child).forEach((key) => {
                    if (isObject(child[key])) {
                        if (!(key in output)) {
                            output[key] = child[key];
                        } else {
                            output[key] = mergeNodes(child[key], base[key]);
                        }
                    } else if (isArray(child[key]) && isArray(base[key])) {
                        if (key === 'extends') {
                            output[key] = child[key];
                        } else {
                            output[key] = [...base[key], ...child[key]];
                        }
                    } else {
                        output[key] = child[key];
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
                throw new Error('Unresolvable inheritance in specification!');
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
                if (visited.includes(visitedNodeName)) {
                    throw new Error(`Repeated class in "extends" list:  ${visitedNodeName}`);
                }
                visited.push(visitedNodeName);

                const visitedNode = nodes.find((n) => n.name === visitedNodeName);

                if (visitedNode.extends !== undefined) {
                    toVisit = [...toVisit, ...visitedNode.extends];
                }

                const nodeName = node.name;
                Object.assign(node, mergeNodes(node, visitedNode));
                node.name = nodeName;
            }
            resolvedNodes.push(node);
        });

        return resolvedNodes;
    }

    /**
     * Serializes and returns current dataflow in Pipeline Manager format.
     *
     * @returns Serialized dataflow.
     */
    saveDataflow() {
        const save = this.baklavaView.editor.save();
        save.version = this.specificationVersion;

        if (this.baklavaView.connectionRenderer.randomizedOffset) {
            if (save.metadata === undefined) {
                save.metadata = {};
            }

            save.metadata.randomizedOffset = true;
        }

        return save;
    }

    /**
     * Loads the dataflow passed in `dataflow` and renders it.
     * If the dataflow is not compatible with the currently loaded specification or is not
     * in the dataflow format, then some of the dataflow may be not loaded and an
     * error is returned. Dataflow should be passed in PipelineManager format (translation
     * to Baklava format is done )
     *
     * @param dataflow Dataflow to load. Can be eithe an object or a string
     * @returns An array of errors that occurred during the dataflow loading.
     * If the array is empty, the loading was successful.
     */
    async loadDataflow(dataflow) {
        const validationErrors = this.validateDataflow(dataflow);
        if (validationErrors.length) {
            return { errors: validationErrors, warnings: [] };
        }

        try {
            if (typeof dataflow === 'string' || dataflow instanceof String) {
                dataflow = jsonlint.parse(dataflow);
            }

            const specificationVersion = dataflow.version;
            const warnings = [];
            if (specificationVersion === undefined) {
                warnings.push(
                    `Current format specification version is ${this.specificationVersion}. It may result in an unexpected behaviour`,
                );
            } else if (specificationVersion !== this.specificationVersion) {
                warnings.push(
                    `Dataflow format specification version (${specificationVersion}) differs from the current format specification version (${this.specificationVersion}). It may result in unexpected behaviour.`,
                );
            }

            if ('metadata' in dataflow && this.currentSpecification !== undefined) {
                const errors = this.validateMetadata(dataflow.metadata);
                if (Array.isArray(errors) && errors.length) {
                    return { errors, warnings };
                }

                this.updateMetadata(dataflow.metadata, true);
            } else {
                this.updateMetadata();
            }
            const errors = { errors: await this.baklavaView.editor.load(dataflow), warnings };
            this.baklavaView.history.graphSwitch(this.baklavaView.displayedGraph, undefined);
            return errors;
        } catch (err) {
            return {
                errors: [
                    'Unrecognized format. Make sure that the passed dataflow is correct.',
                    err.toString(),
                ],
                warnings: [],
            };
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
     * Validates JSON data using given JSON schema. If passed `data` is a string that represents
     * text of specification file then more information about potential errors - like the exact
     * line of error - is returned.
     *
     * @param data Specification file to validate. Can be either a parsed JSON object
     * or a textual file
     * @param schema Schema to use
     * @returns An array of errors. If the array is empty, the validation was successful.
     */
    /* eslint-disable class-methods-use-this */
    validateJSONWithSchema(data, schema) {
        const ajv = new Ajv2019({
            allowUnionTypes: true,
            schemas: [
                unresolvedSpecificationSchema,
                specificationSchema,
                metadataSchema,
                dataflowSchema,
                graphSchema,
            ],
        });
        ajv.addKeyword('version');

        const validate = ajv.compile(schema);
        const isTextFormat = typeof data === 'string' || data instanceof String;
        let dataJSON;

        try {
            dataJSON = isTextFormat ? jsonlint.parse(data) : data;
        } catch (exception) {
            return [`Not a proper JSON file: ${exception.toString()}`];
        }

        const valid = validate(dataJSON);

        if (valid) {
            return [];
        }

        // Parsing errors messages to a human readable string
        const errors = validate.errors.map((error) => {
            // It is assumed that the id of the schema is for example `dataflow_schema`
            // Here a prefix is obtained
            const nameOfEntity = schema.$id.split('_').slice(0, -1).join('_');
            const path = `${nameOfEntity}${error.instancePath}`;
            let errorPrefix = '';

            if (isTextFormat) {
                const result = jsonMap.parse(data);
                // 1 is added as the lines are numbered from 0
                const lineStart = result.pointers[error.instancePath].value.line + 1;
                const lineEnd = result.pointers[error.instancePath].valueEnd.line + 1;

                if (lineStart === lineEnd) {
                    errorPrefix = `Line ${lineStart} -`;
                } else {
                    errorPrefix = `Lines ${lineStart}-${lineEnd} -`;
                }
            }

            switch (error.keyword) {
                case 'enum':
                    return `${errorPrefix} ${path} ${error.message} - ${stringify(
                        error.params.allowedValues,
                    )}`;
                case 'additionalProperties':
                    return `${errorPrefix} ${path} ${error.message} - ${stringify(
                        error.params.additionalProperty,
                    )}`;
                default:
                    return `${errorPrefix} ${path} ${error.message}`;
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
        return this.validateJSONWithSchema(jsonmetadata, metadataSchema);
    }

    /**
     * Validates metadata in JSON format using schema from dataflowSchema.
     *
     * @param jsonmetadata dataflow in JSON format to validate
     * @return An array of errors. If the array is empty, the validation was successful.
     */
    validateDataflow(jsonmetadata) {
        return this.validateJSONWithSchema(jsonmetadata, dataflowSchema);
    }

    /**
     * Checks whether currently edited pipeline is one of the subgraphs
     *
     * @returns True if editor is editing subgraph instance, false otherwise
     */
    isInsideSubgraph() {
        return this.baklavaView.displayedGraph !== this.baklavaView.editor.graph;
    }

    /**
     * Switches the editor state to main graph
     */
    returnFromSubgraph() {
        this.baklavaView.editor.backFromSubgraph(this.baklavaView.displayedGraph);
    }
}
