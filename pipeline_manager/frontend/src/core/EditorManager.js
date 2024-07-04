/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
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

import { NodeFactory, GraphFactory } from './NodeFactory.js';
import unresolvedSpecificationSchema from '../../../resources/schemas/unresolved_specification_schema.json' assert { type: 'json' };
import specificationSchema from '../../../resources/schemas/specification_schema.json' assert { type: 'json' };
import metadataSchema from '../../../resources/schemas/metadata_schema.json' assert { type: 'json' };
import dataflowSchema from '../../../resources/schemas/dataflow_schema.json' assert { type: 'json' };
import graphSchema from '../../../resources/schemas/graph_schema.json' assert { type: 'json' };
import ConnectionRenderer from './ConnectionRenderer.js';

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

/**
 * Translates the provided url according to
 * the optional substitution spec provided at compile time.
 *
 * @param loc the encoded URL location of the resource
 * @returns a translated URL
 */
function parseLocation(loc) {
    let relativeurl = '{}';
    if (typeof document !== 'undefined') {
        const urlparent = document.location.href.split('/').slice(0, -1).join('/');
        relativeurl = `${urlparent}/{}`;
    }
    const defaultsubs = `{"https": "https://{}", "http": "http://{}", "relative": "${relativeurl}"}`;
    const jsonsubs = process.env.VUE_APP_JSON_URL_SUBSTITUTES ?? defaultsubs;
    const subs = JSON.parse(jsonsubs);
    const parts = loc.split('//');

    if (parts.length < 2) return undefined;

    const key = parts[0].substring(0, parts[0].length - 1);
    const specifiedUrl = parts.slice(1).join('');

    if (!Object.keys(subs).includes(key)) return undefined;
    return subs[key].replace('{}', specifiedUrl);
}

/**
 * Loads the JSON file from the remote location given in URL.
 *
 * @param customLocation the URL location of the resource
 * @returns a tuple of a boolean and a JSON object or an error message.
 * The boolean is true if the JSON was successfully loaded and parsed
 */
export async function loadJsonFromRemoteLocation(customLocation) {
    const location = parseLocation(customLocation);
    if (location === undefined) {
        return [false, `Could not download the resource from:  ${customLocation}.`];
    }
    let fetchedContent;
    try {
        fetchedContent = await fetch(location, { mode: 'cors' });
    } catch (error) {
        return [false, error.message];
    }
    try {
        const jsonContent = await fetchedContent.json();
        return [true, jsonContent];
    } catch (error) {
        return [false, error.message];
    }
}

export default class EditorManager {
    static instance;

    defaultMetadata = new Metadata();

    editor = new PipelineManagerEditor();

    baklavaView = useBaklava(this.editor);

    specificationLoaded = ref(false);

    currentSpecification = undefined;
    unresolvedSpecification = undefined;

    updatedMetadata = {};

    constructor() {
        // Baklava's view registers subgraph input and output nodes
        // This call un-registers them as obsolete
        this.editor.unregisterNodes();

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
        this.baklavaView.navbarItems = this.defaultMetadata.navbarItems;
        this.baklavaView.cache = {};
        this.baklavaView.logLevel = this.defaultMetadata.logLevel;

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
     * @param lazyLoad Decides whether to actually load the specification or just store
     * it and check its versioning. Can be used when loading parts of specification manually.
     * @returns An object consisting of errors and warnings arrays. If any array is empty
     * the updating process was successful.
     */
    /* eslint-disable no-underscore-dangle,no-param-reassign */
    async updateEditorSpecification(dataflowSpecification, lazyLoad = false) {
        if (!dataflowSpecification) return ['No specification passed'];

        if (typeof dataflowSpecification === 'string' || dataflowSpecification instanceof String) {
            try {
                dataflowSpecification = jsonlint.parse(dataflowSpecification);
            } catch (error) {
                return { errors: [error], warnings: [] };
            }
        }

        if (this.specificationLoaded) {
            this.baklavaView.editor.unregisterGraphs();
            this.baklavaView.editor.cleanEditor();
            this.baklavaView.editor.unregisterNodes();
            this.specificationLoaded = false;
        }

        const warnings = [];
        const errors = [];
        const { version } = dataflowSpecification; // eslint-disable-line object-curly-newline,max-len
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

        this.unresolvedSpecification = JSON.parse(JSON.stringify(dataflowSpecification));
        this.currentSpecification = dataflowSpecification;
        if (!lazyLoad) {
            // Preprocess includes
            this.globalVisitedSpecs = new Set();
            const {
                specification: unresolvedSpecification, errors: includeErrors,
            } = await this.downloadNestedImports(dataflowSpecification);
            errors.push(...includeErrors);
            if (errors.length) {
                return { errors, warnings };
            }

            // Include graphs
            const {
                graphs, errors: includeGraphsErrors,
            } = await EditorManager.includeGraphs(unresolvedSpecification.includeGraphs ?? []);

            errors.push(...includeGraphsErrors);
            if (errors.length) {
                return { errors, warnings };
            }

            // Update metadata
            const { metadata } = unresolvedSpecification;
            errors.push(...this.updateMetadata(metadata, false, true));
            if (errors.length) {
                return { errors, warnings };
            }

            unresolvedSpecification.graphs = [
                ...(unresolvedSpecification.graphs ?? []),
                ...graphs,
            ];

            // Update graph specification
            const {
                errors: newErrors, warnings: newWarnings,
            } = await this.updateGraphSpecification(unresolvedSpecification);
            errors.push(...newErrors);
            warnings.push(...newWarnings);
        }

        if (errors.length === 0) {
            this.specificationLoaded = true;
        }

        return { errors, warnings };
    }

    /**
     * Downloads nested imports from the specification and returns an object
     * consisting of nodes, graphs, and errors arrays.
     *
     * @param specification Specification to load.
     * @param trace Set of visited specifications to detect circular imports.
     * @returns Merged specification and errors.
     */
    async downloadNestedImports(specification, trace = new Set()) {
        const errors = [];

        // Download specifications and verify for circular imports
        const specificationAndTrace = [];
        const currentImports = new Set();
        const include = specification.include ?? [];
        await Promise.all(include.map(async (specificationUrl) => {
            if (currentImports.has(specificationUrl)) {
                errors.push(`Specification is included multiple times, skipping ${specificationUrl}`);
                return;
            }
            if (trace.has(specificationUrl)) {
                errors.push(`Circular dependency detected in included specification ${specificationUrl}`);
                return;
            }
            currentImports.add(specificationUrl);

            if (!this.globalVisitedSpecs.has(specificationUrl)) {
                this.globalVisitedSpecs.add(specificationUrl);
                const [status, val] = await loadJsonFromRemoteLocation(specificationUrl);
                if (status === false) {
                    errors.push(`Could not load the included specification from ${specificationUrl}. Reason: ${val}`);
                } else {
                    specificationAndTrace.push(
                        {
                            specification: val,
                            trace: new Set([...trace, specificationUrl]), // Detect circular imports
                        },
                    );
                }
            }
        }));

        if (errors.length) {
            return { specification, errors };
        }

        // Download nested imports
        await Promise.all(specificationAndTrace.map(
            async ({ specification: spec, trace: specTrace },
            ) => {
                const {
                    specification: newSpecification, errors: newErrors,
                } = await this.downloadNestedImports(spec, specTrace);
                errors.push(...newErrors);
                specification = EditorManager.mergeObjects(specification, newSpecification);
            }));
        return { specification, errors };
    }

    /**
     * Downloads included dataflows from the specification and converts them to the
     * graphs format to be included into the specification.
     *
     * @param includeGraphs Array of included graphs
     * @returns Array of subgraphs and an array of errors that occurred during the process.
     */
    static async includeGraphs(includeGraphs) {
        const errors = [];
        const graphs = [];

        if (includeGraphs.length === 0) {
            return { graphs, errors };
        } if (includeGraphs.length !== new Set(includeGraphs).size) {
            errors.push('Duplicate subgraph includes detected. Aborting.');
            return { graphs, errors };
        }

        await Promise.all(includeGraphs.map(async (dataflow) => {
            const [status, val] = await loadJsonFromRemoteLocation(dataflow.url);
            if (status === false) {
                errors.push(`Could not load the included dataflow from ${dataflow}. Reason: ${val}`);
                return;
            }

            // Validate the fetched dataflow
            const validationErrors = EditorManager.validateDataflow(val);
            if (validationErrors.length) {
                errors.push(...validationErrors);
                return;
            }

            if (val.graphs.length !== 1) {
                errors.push(`Only single graph dataflows are supported. Aborting loading subgraph include from ${dataflow.url}.`);
                return;
            }

            let targetGraph;
            if (val.entryGraph === undefined) {
                targetGraph = val.graphs[0]; // eslint-disable-line prefer-destructuring
            } else {
                targetGraph = val.graphs.find((graph) => graph.id === val.entryGraph);
            }

            targetGraph.name = dataflow.name ?? targetGraph.name;
            targetGraph.category = dataflow.category ?? undefined;

            if (targetGraph.name === undefined) {
                errors.push(`Included subgraph from '${dataflow.url}' does not have a name defined.`);
                return;
            }

            if (graphs.find((graph) => graph.name === targetGraph.name) !== undefined) {
                errors.push(`Included graph from '${dataflow.url}' has a duplicate name`);
                return;
            }

            graphs.push(targetGraph);
        }));
        return { graphs, errors };
    }

    /**
     * Reads and validates part of specification related to nodes and graphs
     * @param dataflowSpecification Specification to load
     * @returns An object consisting of errors and warnings arrays. If any array is empty
     * the updating process was successful.
     */
    async updateGraphSpecification(dataflowSpecification) {
        const warnings = [];

        if (!dataflowSpecification) return { errors: ['No specification passed'], warnings };

        const { nodes, graphs, metadata } = dataflowSpecification;

        let resolvedNodes = [];

        try {
            const preprocessedNodes = this.preprocessNodes(nodes);
            resolvedNodes = this.resolveInheritance(preprocessedNodes);
        } catch (e) {
            return { errors: [e.message], warnings };
        }

        const errors = [];
        errors.push(...this.validateResolvedSpecification(
            { graphs, nodes: resolvedNodes, metadata },
        ));
        if (errors.length) {
            return { errors, warnings };
        }

        this.currentSpecification.nodes = JSON.parse(JSON.stringify(resolvedNodes));

        // Resolving siblings, parents and children

        // Resolving children
        resolvedNodes.forEach((node) => {
            (node.extends ?? []).forEach((eName) => {
                const extended = resolvedNodes.find((n) => n.name === eName);

                // The extended node could be abstract, in which way it is not in resolved nodes.
                if (extended !== undefined) {
                    if (extended.extending === undefined) {
                        extended.extending = [];
                    }
                    extended.extending.push(node.name);
                }
            });
        });

        // Resolving siblings
        resolvedNodes.forEach((node) => {
            const siblings = new Set();
            (node.extends ?? []).forEach((eName) => {
                const extended = resolvedNodes.find((n) => n.name === eName);

                // The extended node could be abstract, in which way it is not in resolved nodes.
                if (extended !== undefined) {
                    extended.extending.forEach((e) => siblings.add(e));
                }
            });
            siblings.delete(node.name);
            node.siblings = Array.from(siblings);
        });

        // Removing abstract parents
        resolvedNodes.forEach((node) => {
            if (node.extends) {
                node.extends = node.extends.filter(
                    (eName) => (resolvedNodes.find((n) => n.name === eName) !== undefined),
                );
            }
        });

        resolvedNodes.forEach((node) => {
            const myNode = NodeFactory(
                node.name,
                node.layer,
                node.interfaces ?? [],
                node.properties ?? [],
                node.interfaceGroups ?? [],
                node.defaultInterfaceGroups ?? [],
                metadata?.twoColumn ?? false,
                node.description ?? '',
                node.extends ?? [],
                node.extending ?? [],
                node.siblings ?? [],
            );

            // If my node is any array then it is an array of errors
            if (Array.isArray(myNode) && myNode.length) {
                errors.push(...myNode);
                return;
            }

            this.baklavaView.editor.registerNodeType(myNode, {
                title: node.name,
                category: node.category,
                isCategory: node.isCategory ?? false,
            });
            if ('icon' in node) {
                if (typeof node.icon === 'string') {
                    this.baklavaView.editor.nodeIcons.set(node.name, node.icon);
                } else {
                    const baseName = Object.keys(node.icon)[0];
                    const suffix = Object.values(node.icon)[0];
                    const baseUrl = this.baklavaView.editor.baseIconUrls.get(baseName);
                    this.baklavaView.editor.nodeIcons.set(node.name, `${baseUrl}/${suffix}`);
                }
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
            return { errors, warnings };
        }

        if (graphs !== undefined) {
            graphs.forEach((graph) => {
                const myGraph = GraphFactory(
                    graph.nodes,
                    graph.connections,
                    graph.name,
                    this.baklavaView.editor,
                );

                // If `myGraph` is any array then it is an array of errors
                if (Array.isArray(myGraph) && myGraph.length) {
                    errors.push(...myGraph);
                    return;
                }

                this.baklavaView.editor.addGraphTemplate(
                    myGraph,
                    graph.category,
                    graph.name,
                );
            });
        }

        return { errors, warnings };
    }

    /**
     * Preprocess nodes to be later passed to `resolveInheritance` function.
     *
     * @param nodes coming from specification.
     * @throws Error if a category node has a name different than the last part of its category.
     */
    preprocessNodes(nodes) { // eslint-disable-line class-methods-use-this
        nodes.forEach((node) => {
            if (node.isCategory) {
                const name = node.category.split('/').at(-1);
                if (node.name !== undefined && node.name !== name) {
                    throw new Error(`Node '${node.name}' is a category node and has a name defined different than ${name}`);
                }
                node.name = name;
            }
        });
        return nodes;
    }

    /**
     * Reads and validates metadata from specification and loads it into the editor.
     * if no metadata is passed it uses a stored specification.
     *
     * @param metadata metadata to load
     * @param overriding tells whether the metadata is updated on dataflow loading
     * @param loading resets updated metadata, should be used when loading new dataflow
     * @returns An array of errors that occurred during the metadata loading.
     */
    updateMetadata(metadata = undefined, overriding = false, loading = false) {
        if (loading) this.updatedMetadata = {};
        let newMetadata;
        if (metadata !== undefined) {
            metadata = { ...this.updatedMetadata, ...metadata };
            newMetadata = JSON.parse(JSON.stringify(metadata));
        }
        if (metadata === undefined && this.currentSpecification) {
            metadata = this.currentSpecification.metadata ?? {};
        }

        if (!metadata) return ['No specification to load provided.'];

        if (overriding) {
            // this.currentSpecification?.metadata should not be over overridden, that is why
            // it needs to be copied before merging
            metadata = EditorManager.mergeObjects(
                JSON.parse(JSON.stringify(this.currentSpecification?.metadata ?? {})), metadata,
            );
        }

        this.baklavaView.interfaceTypes.readInterfaceTypes(metadata);

        if (metadata && 'urls' in metadata) {
            Object.entries(metadata.urls).forEach(([urlName, state]) => {
                this.baklavaView.editor.baseURLs.set(urlName, state);
            });
        }

        if (metadata && 'icons' in metadata) {
            Object.entries(metadata.icons).forEach(([iconName, state]) => {
                this.baklavaView.editor.baseIconUrls.set(iconName, state);
            });
        }

        if (metadata && 'navbarItems' in metadata) {
            this.baklavaView.navbarItems = metadata.navbarItems;
        }

        this.baklavaView.editor.readonly = metadata?.readonly ?? this.defaultMetadata.readonly;
        this.baklavaView.editor.hideHud = metadata?.hideHud ?? this.defaultMetadata.hideHud;

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
        this.baklavaView.logLevel = metadata?.logLevel ?? this.defaultMetadata.logLevel;
        if (newMetadata) this.updatedMetadata = newMetadata;

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
            const output = { ...structuredClone(base) };
            const nonInheritableKeys = ['abstract', 'isCategory'];

            nonInheritableKeys.forEach((key) => {
                delete output[key];
            });

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
                            const baseNames = Object.fromEntries(
                                base[key].map((obj, i) => [obj.name, i]),
                            );
                            child[key].forEach((obj) => {
                                if (obj.name && obj.name in baseNames) {
                                    const index = baseNames[obj.name];
                                    if (obj.override) {
                                        output[key][index] = {
                                            ...base[key][index],
                                            ...obj,
                                        };
                                        delete output[key][index].override;
                                    } else {
                                        throw new Error(`'${child.name}' node cannot override '${obj.name}' property of '${base.name}' node`);
                                    }
                                } else {
                                    output[key].push(obj);
                                }
                            });
                        }
                    } else {
                        output[key] = child[key];
                    }
                });
            }
            return output;
        };

        const resolvedNodes = {};
        const recurrentMerge = (name) => {
            // Node resolved
            if (name in resolvedNodes) return resolvedNodes[name];
            let node = nodes.find((n) => n.name === name);
            // Node does not inherite anything
            if (!node.extends) {
                resolvedNodes[name] = node;
                return node;
            }
            // Check if extends has unique values
            if ((new Set(node.extends)).size !== node.extends.length) {
                throw new Error(`Repeated class in "extends" list of "${node.name}" node`);
            }
            // Get base nodes and merge them
            let base;
            node.extends.forEach((baseName) => {
                base = recurrentMerge(baseName);
                node = mergeNodes(node, base);
            });
            resolvedNodes[name] = node;
            return node;
        };
        // Filter out abstract nodes and get merged ones
        const mergedNodes = unsortedNodes.filter(
            (node) => !node.abstract,
        ).map((node) => recurrentMerge(node.name));

        return mergedNodes;
    }

    /**
     * Serializes and returns current specification in Pipeline Manager format.
     *
     * @returns Serialized specification.
     */
    saveSpecification() {
        return JSON.parse(JSON.stringify(this.unresolvedSpecification));
    }

    /**
     * Serializes and returns current dataflow in Pipeline Manager format.
     *
     * @param readonly whether the dataflow should be saved in readonly mode
     * @param hideHud whether the dataflow should be saved in hideHud mode
     * @param position whether the dataflow should store panning and scaling values
     * @param graphname graph name which is rendered to the user
     *
     * @returns Serialized dataflow.
     */
    saveDataflow(readonly, hideHud, position) {
        const save = this.baklavaView.editor.save();
        save.version = this.specificationVersion;

        if (!position) {
            save.graphs.forEach((graph) => {
                delete graph.panning;
                delete graph.scaling;
            });
        }

        if (save.metadata === undefined) {
            save.metadata = {};
        }

        [
            [readonly, 'readonly'],
            [hideHud, 'hideHud'],
            [this.editor.allowLoopbacks, 'allowLoopbacks'],
            [this.baklavaView.twoColumn, 'twoColumn'],
            [this.baklavaView.connectionRenderer.style, 'connectionStyle'],
            [this.baklavaView.movementStep, 'movementStep'],
            [this.baklavaView.settings.background.gridSize, 'backgroundSize'],
            [this.baklavaView.connectionRenderer.randomizedOffset, 'randomizedOffset'],
        ].forEach(([currVal, name]) => {
            const m = this.currentSpecification?.metadata ?? {};
            const dm = this.defaultMetadata;

            if (currVal !== (m[name] ?? dm[name])) {
                save.metadata[name] = currVal;
            }
        });

        if (Object.keys(save.metadata).length === 0) {
            delete save.metadata;
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
     * @param preventCentering Boolean Blocks view in the same spot.
     * @returns An array of errors that occurred during the dataflow loading.
     * If the array is empty, the loading was successful.
     */
    async loadDataflow(dataflow, preventCentering = false) {
        let { notifyWhenChanged } = this;
        // Turn off notification during dataflow loading
        this.updateMetadata({ notifyWhenChanged: false }, true, true);
        try {
            const validationErrors = EditorManager.validateDataflow(dataflow);
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
                    const errors = EditorManager.validateMetadata(dataflow.metadata);
                    if (Array.isArray(errors) && errors.length) {
                        return { errors, warnings };
                    }
                    notifyWhenChanged = dataflow.metadata.notifyWhenChanged ?? notifyWhenChanged;

                    this.updateMetadata(
                        { ...dataflow.metadata, notifyWhenChanged: false },
                        true,
                        true,
                    );
                }
                if (this.baklavaView.displayedGraph !== undefined) {
                    // Delete baklava internal history listeners
                    this.baklavaView.history.unsubscribeFromGraphEvents(
                        this.baklavaView.displayedGraph,
                        Symbol('HistoryToken'),
                    );
                }
                const errors = {
                    errors: await this.baklavaView.editor.load(dataflow, preventCentering),
                    warnings,
                };
                this.baklavaView.history.graphSwitch(
                    this.baklavaView.displayedGraph,
                    this.baklavaView.displayedGraph,
                );
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
        } finally {
            // Restore previous state or use value from loaded dataflow
            this.updateMetadata({ notifyWhenChanged }, true);
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
     * Static helper function to merge two object instances into a single.
     * The following rules are applied:
     * - If the property is an array then it is concatenated
     * - If the property is an object then it is merged with preference to the first object
     * - If the property is a simple type then it is overwritten with the first object
     * - On type mismatch (array/object), the first object is used
     *
     * @param primaryObject First object to merge
     * @param secondaryObject Second object to merge
     * @returns Primary object with merged properties from the secondary object
     */
    static mergeObjects(primaryObject, secondaryObject) {
        // Check if any of the object is undefined
        secondaryObject = secondaryObject ?? {};
        if (primaryObject === undefined || Object.keys(primaryObject).length === 0) {
            return secondaryObject;
        }

        // Merge object
        Object.entries(secondaryObject).forEach(([key, value]) => {
            if (Array.isArray(value) && Array.isArray(primaryObject[key])) {
                primaryObject[key].push(...value);
            } else if (typeof value === 'object' && typeof primaryObject[key] === 'object') {
                // For example, metadata is an object and it has to be merged instead of overwritten
                primaryObject[key] = EditorManager.mergeObjects(primaryObject[key], value);
            } else {
                primaryObject[key] = value;
            }
        });
        return primaryObject;
    }

    /**
     * Validates JSON data using given JSON schema. If passed `data` is a string that represents
     * text of specification file then more information about potential errors - like the exact
     * line of error - is returned.
     *
     * @param data Specification file to validate. Can be either a parsed JSON object
     * or a textual file
     * @param schema Schema to use
     * @param additionalAjvOptions Additional options to pass to the Ajv constructor
     * @returns An array of errors. If the array is empty, the validation was successful.
     */
    static validateJSONWithSchema(data, schema, additionalAjvOptions = {}) {
        const ajv = new Ajv2019({
            allowUnionTypes: true,
            formats: {
                hex: /^0x[a-fA-F0-9]+$/,
            },
            schemas: [
                unresolvedSpecificationSchema,
                specificationSchema,
                metadataSchema,
                dataflowSchema,
                graphSchema,
            ],
            ...additionalAjvOptions,
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
                case 'const':
                    return `${errorPrefix} ${path} ${error.message} - ${stringify(
                        error.params.allowedValue,
                    )}`;
                case 'unevaluatedProperties':
                    return `${errorPrefix} ${path} ${error.message} - ${stringify(
                        error.params.unevaluatedProperty,
                    )}}`;
                // Those errors are not informative at all
                case 'not':
                case 'oneOf':
                    return '';
                default:
                    return `${errorPrefix} ${path} ${error.message}`;
            }
        });

        return errors.filter((err) => err !== '');
    }

    validateResolvedSpecification(specification) {
        const validationErrors = EditorManager.validateSpecification(
            specification, specificationSchema);
        if (validationErrors.length) return validationErrors;

        // Validating category nodes
        const { nodes, graphs } = specification;
        const categoryNodes = nodes.filter((node) => node.isCategory);
        const definedCategories = {};

        // Finding multiple category nodes defining the same category
        const errors = [];
        categoryNodes.forEach((node) => {
            if (node.name in definedCategories) {
                errors.push(`Category '${node.category}' has multiple nodes defining it.`);
            } else {
                definedCategories[node.name] = node.category.split('/').slice(0, -1).join('/');
            }
        });

        // Nodes have to extend the first category node in their category path.
        // For example, if we have two category nodes A and C and we have a node e
        // which has a category 'A/b/C/d/e' then it has to extend C (and C has to extend A)
        const nodeNames = new Set();
        nodes.forEach((node) => {
            const categories = node.category.split('/');

            for (let i = categories.length - 1; i >= 0; i -= 1) {
                const categoryNodeName = categories[i];
                const remainingCategories = categories.slice(0, i).join('/');

                if (
                    categoryNodeName in definedCategories &&
                    node.name !== categoryNodeName &&
                    remainingCategories === definedCategories[categoryNodeName]
                ) {
                    if (node.extends === undefined || !node.extends.includes(categoryNodeName)) {
                        errors.push(`Node '${node.name}' does not extend its category node '${categoryNodeName}'.`);
                    }
                    break;
                }
            }

            // Nodes that extend from a category node have to be in their subtree i.e. have a common
            // category prefix with the category node
            for (let i = 0; i < (node.extends ?? []).length; i += 1) {
                const extendedNode = node.extends[i];
                if (extendedNode in definedCategories) {
                    const commonPrefix = definedCategories[extendedNode] !== '' ?
                        `${definedCategories[extendedNode]}/${extendedNode}` : extendedNode;

                    if (!node.category.includes(commonPrefix)) {
                        errors.push(
                            `Node '${node.name}' extends from a category node '${extendedNode}' but is not in its category`,
                        );
                        break;
                    }
                }
            }

            // Finding multiple nodes with the same name
            if (nodeNames.has(node.name)) {
                errors.push(`Node '${node.name}' is defined multiple times`);
            }
            nodeNames.add(node.name);
        });

        graphs.forEach((graph) => {
            if (nodeNames.has(graph.name)) {
                errors.push(`Graph node name '${graph.name}' is defined multiple times`);
            }
            nodeNames.add(graph.name);
        });
        return errors;
    }

    /**
     * Validates specification passed in `specification` using jsonSchema.
     *
     * @param specification Specification to validate
     * @returns An array of errors. If the array is empty, the validation was successful.
     */
    static validateSpecification(specification, schema = unresolvedSpecificationSchema) {
        return EditorManager.validateJSONWithSchema(specification, schema);
    }

    /**
     * Validates metadata in JSON format using schema from unresolvedSpecificationSchema.
     *
     * @param jsonmetadata metadata in JSON format to validate
     * @return An array of errors. If the array is empty, the validation was successful.
     */
    static validateMetadata(jsonmetadata) {
        return EditorManager.validateJSONWithSchema(jsonmetadata, metadataSchema);
    }

    /**
     * Validates metadata in JSON format using schema from dataflowSchema.
     *
     * @param dataflow dataflow in JSON format to validate
     * @return An array of errors. If the array is empty, the validation was successful.
     */
    static validateDataflow(dataflow) {
        return EditorManager.validateJSONWithSchema(dataflow, dataflowSchema);
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

    /**
     * Updates name of currently displayed graph
     */
    updateSubgraphName(name) {
        this.editor.updateCurrentSubgraphName(name);
    }

    get notifyWhenChanged() {
        return this.updatedMetadata.notifyWhenChanged ??
            this.currentSpecification?.metadata?.notifyWhenChanged ??
            this.defaultMetadata.notifyWhenChanged;
    }
}
