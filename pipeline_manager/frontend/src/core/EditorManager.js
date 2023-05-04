/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import Ajv, { stringify } from 'ajv';

import { useBaklava, DummyConnection, BaklavaInterfaceTypes } from 'baklavajs';

import PipelineManagerEditor from '../custom/Editor';

import { showToast } from './notifications';
import { NodeFactory, readInterfaceTypes } from './NodeFactory';
import specificationSchema from '../../../resources/schemas/dataflow_spec_schema.json';

export default class EditorManager {
    static instance;

    editor = new PipelineManagerEditor();

    baklavaView = useBaklava(this.editor);

    nodeInterfaceTypes = new BaklavaInterfaceTypes(this.editor, {
        viewPlugin: this.baklavaView,
    });

    specificationLoaded = false;

    /* eslint-disable no-underscore-dangle */
    /* eslint-disable no-param-reassign */
    constructor() {
        const graphInstance = this.editor._graph;
        graphInstance.checkConnection = (from, to) => {
            if (!from || !to) {
                return { connectionAllowed: false };
            }

            const fromNode = graphInstance.findNodeById(from.nodeId);
            const toNode = graphInstance.findNodeById(to.nodeId);
            if (fromNode && toNode && fromNode === toNode && !graphInstance.editor.allowLoopbacks) {
                // connections must be between two separate nodes.
                return { connectionAllowed: false };
            }

            if (from.isInput && !to.isInput) {
                // reverse connection
                const tmp = from;
                from = to;
                to = tmp;
            }

            if (from.isInput || !to.isInput) {
                // connections are only allowed from input to output interface
                return { connectionAllowed: false };
            }

            // prevent duplicate connections
            if (graphInstance.connections.some((c) => c.to === to)) {
                return { connectionAllowed: false };
            }

            if (graphInstance.events.checkConnection.emit({ from, to }).prevented) {
                return { connectionAllowed: false };
            }

            const hookResults = graphInstance.hooks.checkConnection.execute({ from, to });
            if (hookResults.some((hr) => !hr.connectionAllowed)) {
                return { connectionAllowed: false };
            }

            const connectionsInDanger = Array.from(
                new Set(hookResults.flatMap((hr) => hr.connectionsInDanger)),
            );
            return {
                connectionAllowed: true,
                dummyConnection: new DummyConnection(from, to),
                connectionsInDanger,
            };
        };
    }

    /**
     * Loads the dataflow specification passed in `dataflowSpecification`.
     * The specification describes what nodes are available in the editor.
     *
     * If the current editor already has a specification loaded then the editor
     * and its plugins are reinitialized and then the specification is loaded.
     *
     * @param dataflowSpecification Specification to load
     */
    updateEditorSpecification(dataflowSpecification) {
        if (!dataflowSpecification) return;
        if (this.specificationLoaded) {
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
        }

        const { nodes, metadata } = dataflowSpecification;

        const interfaceTypes = readInterfaceTypes(nodes, metadata);
        this.nodeInterfaceTypes.addTypes(...Object.values(interfaceTypes));

        nodes.forEach((node) => {
            const myNode = NodeFactory(
                node.name,
                node.name,
                node.inputs,
                node.properties,
                node.outputs,
                interfaceTypes,
            );
            this.editor.registerNodeType(myNode, { title: node.name, category: node.category });
        });

        this.editor.readonly = 'readonly' in metadata ? metadata.readonly : false;
        if (this.editor.readonly) {
            showToast('info', 'The specification is read-only. Only dataflow loading is allowed.');
        }
        this.editor.allowLoopbacks = 'allowLoopbacks' in metadata ? metadata.allowLoopbacks : false;

        this.specificationLoaded = true;
    }

    /**
     * Serializes and returns current dataflow.
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
     * error is returned.
     *
     * @param dataflow Dataflow to load
     * @returns An array of errors that occured during the dataflow loading.
     * If the array is empty, the loading was successful.
     */
    loadDataflow(dataflow) {
        try {
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
     * Validates specification passed in `specification` using jsonSchema.
     *
     * @param specification Specification to validate
     * @returns An array of errors. If the array is empty, the validation was successful.
     */
    /* eslint-disable class-methods-use-this */
    validateSpecification(specification) {
        const ajv = new Ajv();

        const validate = ajv.compile(specificationSchema);
        const valid = validate(specification);
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
}
