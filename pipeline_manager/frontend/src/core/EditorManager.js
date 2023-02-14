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

import NodeFactory from './NodeFactory';
import ListOption from '../options/ListOption.vue';
import specificationSchema from '../../../resources/schemas/dataflow_spec_schema.json';

export default class EditorManager {
    static instance;

    editor = new Editor();

    viewPlugin = new ViewPlugin();

    nodeInterfaceTypes = new InterfaceTypePlugin();

    optionPlugin = new OptionPlugin();

    specificationLoaded = false;

    ajv = new Ajv();

    constructor() {
        this.editor.use(this.viewPlugin);
        this.editor.use(this.nodeInterfaceTypes);
        this.editor.use(this.optionPlugin);
        this.viewPlugin.registerOption('ListOption', ListOption);
    }

    updateEditorSpecification(dataflowSpecification) {
        if (!dataflowSpecification) return;

        this.specificationLoaded = true;
        const { nodes } = dataflowSpecification;
        const { metadata } = dataflowSpecification;

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
            Object.keys(metadata.interfaces).forEach((name, color) => {
                this.nodeInterfaceTypes.addType(name, color);
            });
        }
    }

    saveDataflow() {
        return this.editor.save();
    }

    loadDataflow(dataflow) {
        this.editor.load(dataflow);
    }

    static getEditorManagerInstance() {
        if (!this.instance) {
            this.instance = new EditorManager();
        }
        return this.instance;
    }

    validateSpecification(specification) {
        const validate = this.ajv.compile(specificationSchema);
        const valid = validate(specification);
        if (valid) {
            return null;
        }
        return validate.errors;
    }
}
