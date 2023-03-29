/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Editor } from '@baklavajs/core';
import { ViewPlugin } from '@baklavajs/plugin-renderer-vue';
import { OptionPlugin } from '@baklavajs/plugin-options-vue';
import { InterfaceTypePlugin } from '@baklavajs/plugin-interface-types';
import Ajv from 'ajv';

import CustomNode from '../components/CustomNode.vue';
import NodeFactory from './NodeFactory';
import ListOption from '../options/ListOption.vue';
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
        this.editor = new Editor();
        this.nodeInterfaceTypes = new InterfaceTypePlugin();
        this.viewPlugin = new ViewPlugin();
        this.optionPlugin = new OptionPlugin();

        this.viewPlugin.registerOption('ListOption', ListOption);
        this.viewPlugin.components.node = CustomNode;
        this.editor.use(this.viewPlugin);
        this.editor.use(this.nodeInterfaceTypes);
        this.editor.use(this.optionPlugin);
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
        return validate.errors;
    }
}
