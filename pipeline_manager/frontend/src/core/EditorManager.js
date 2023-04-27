/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ViewPlugin } from '@baklavajs/plugin-renderer-vue';
import { OptionPlugin } from '@baklavajs/plugin-options-vue';
import { InterfaceTypePlugin } from '@baklavajs/plugin-interface-types';
import Ajv, { stringify } from 'ajv';

import PipelineManagerEditor from '../custom/Editor';
import CustomNode from '../custom/CustomNode.vue';
import CustomInterface from '../custom/CustomInterface.vue';
import CustomOption from '../custom/CustomOption.vue';
import ContextMenu from '../custom/ContextMenu.vue';
import PipelineManagerConnection from '../custom/connection/PipelineManagerConnection.vue';

import { showToast } from './notifications';
import NodeFactory from './NodeFactory';
import ListOption from '../options/ListOption.vue';
import InputOption from '../options/InputOption.vue';
import specificationSchema from '../../../resources/schemas/dataflow_spec_schema.json';

export default class EditorManager {
    static instance;

    editor = null;

    nodeInterfaceTypes = null;

    viewPlugin = null;

    optionPlugin = null;

    specificationLoaded = false;

    ajv = new Ajv();

    constructor() {
        this.initializeEditor();
    }

    /**
     * Reinitializes current editor and its plugins.
     * It is used to reset the environment.
     */
    initializeEditor() {
        this.editor = new PipelineManagerEditor();

        this.nodeInterfaceTypes = new InterfaceTypePlugin();
        this.viewPlugin = new ViewPlugin();
        this.optionPlugin = new OptionPlugin();

        this.viewPlugin.components.node = CustomNode;
        this.viewPlugin.components.contextMenu = ContextMenu;
        this.viewPlugin.components.connection = PipelineManagerConnection;
        this.viewPlugin.components.nodeInterface = CustomInterface;
        this.viewPlugin.components.nodeOption = CustomOption;

        this.editor.use(this.viewPlugin);
        this.viewPlugin.registerOption('ListOption', ListOption);
        this.viewPlugin.registerOption('CustomInputOption', InputOption);

        this.editor.use(this.nodeInterfaceTypes);
        this.editor.use(this.optionPlugin);

        this.specificationLoaded = false;
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
            this.initializeEditor();
        }

        this.specificationLoaded = true;
        const { nodes, metadata } = dataflowSpecification;
        nodes.forEach((node) => {
            const myNode = NodeFactory(
                node.name,
                node.name,
                node.inputs,
                node.properties,
                node.outputs,
            );
            this.editor.registerNodeType(node.name, myNode, node.category);
        });

        if ('interfaces' in metadata) {
            Object.entries(metadata.interfaces).forEach(([name, color]) => {
                this.nodeInterfaceTypes.addType(name, color);
            });
        }
        this.editor.readonly = 'readonly' in metadata ? metadata.readonly : false;
        if (this.editor.readonly) {
            showToast('info', 'The specification is read-only. Only dataflow loading is allowed.');
        }
        if ('allowLoopbacks' in metadata) {
            this.editor.allowLoopbacks = metadata.allowLoopbacks;
        }
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
        } catch {
            return ['Unrecognized format. Make sure that the passed dataflow is correct.'];
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
    validateSpecification(specification) {
        const validate = this.ajv.compile(specificationSchema);
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
