/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ViewPlugin } from '@baklavajs/plugin-renderer-vue';
import { OptionPlugin } from '@baklavajs/plugin-options-vue';
import { InterfaceTypePlugin } from '@baklavajs/plugin-interface-types';
import Ajv from 'ajv';

import CustomNode from '../components/CustomNode.vue';
import ContextMenu from '../components/ContextMenu.vue';
import NodeFactory from './NodeFactory';
import ListOption from '../options/ListOption.vue';
import specificationSchema from '../../../resources/schemas/dataflow_spec_schema.json';
import PipelineManagerEditor from './Editor';

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

        this.viewPlugin.registerOption('ListOption', ListOption);
        this.viewPlugin.components.node = CustomNode;
        this.viewPlugin.components.contextMenu = ContextMenu;
        this.editor.use(this.viewPlugin);
        this.editor.use(this.nodeInterfaceTypes);
        this.editor.use(this.optionPlugin);

        this.viewPlugin.hooks.renderConnection.tap(this, (c) => {
            if (
                !c.$el.getAttribute('data-from-node') ||
                c.$el.getAttribute('data-from-node') !== c.$el.getAttribute('data-to-node')
            ) {
                // do not make changes to render if it's temporary connection or it's not loopback
                return c;
            }
            const regex =
                /M (\d+\.?\d*) (\d+\.?\d*) C (?:\d+\.?\d* \d+\.?\d*, ){2}(\d+\.?\d*) (\d+\.?\d*)["]/;
            const path = regex.exec(c.$el.outerHTML);
            if (!path || path.length !== 5) {
                return c;
            }
            const x1 = Number(path[1]);
            const y1 = Number(path[2]);
            const x2 = Number(path[3]);
            const y2 = Number(path[4]);
            const nodeHtml = document.getElementById(c.$el.getAttribute('data-from-node'));
            const scale = nodeHtml.getBoundingClientRect().height / nodeHtml.offsetHeight;
            const BottomY =
                (nodeHtml.offsetTop + nodeHtml.offsetHeight) * scale +
                nodeHtml.parentNode.offsetTop;

            /*
            Find level how deep away from the node should the connection loop back. Each output
            interface has it own layer so that the connection representing data coming from the
            same output are grouped together, splitting only when close to inputs, while two
            different outputs have different paths altogether.
            */
            const outInterfaceHtml = document.getElementById(c.$el.getAttribute('data-from'));
            const childArray = Array.from(outInterfaceHtml.parentNode.childNodes);
            const connLevel =
                childArray.reverse().findIndex((n) => n.id === outInterfaceHtml.id) + 1;

            const shift = 30;
            const slope = 1;
            const y = BottomY + connLevel * shift;

            const rightCx = x1 - connLevel * shift;
            const rightCy = (y + y1) / 2;
            const rightRx = Math.sqrt(
                Math.abs(
                    (x1 - rightCx) * (x1 - rightCx) + ((x1 - rightCx) * (y - rightCy)) / slope,
                ),
            );
            const rightRy = Math.sqrt(
                Math.abs((y - rightCy) * (y - rightCy) + (x1 - rightCx) * (y - rightCy) * slope),
            );

            const bottomCx = (x1 + x2) / 2;
            const bottomCy = BottomY;
            const bottomRx = Math.sqrt(
                Math.abs(
                    (x1 - bottomCx) * (x1 - bottomCx) + ((x1 - bottomCx) * (y - bottomCy)) / slope,
                ),
            );
            const bottomRy = Math.sqrt(
                Math.abs(
                    (y - bottomCy) * (y - bottomCy) + (x1 - bottomCx) * (y - bottomCy) * slope,
                ),
            );

            const leftCx = x2 + connLevel * shift;
            const leftCy = (y + y2) / 2;
            const leftRx = Math.sqrt(
                Math.abs((x2 - leftCx) * (x2 - leftCx) + ((x2 - leftCx) * (y - leftCy)) / -slope),
            );
            const leftRy = Math.sqrt(
                Math.abs((y - leftCy) * (y - leftCy) + (x2 - leftCx) * (y - leftCy) * -slope),
            );

            c.$el.setAttribute(
                'd',
                `M ${x1} ${y1}
                A ${rightRx} ${rightRy} 0 0 1 ${x1} ${y}
                A ${bottomRx} ${bottomRy} 0 0 1 ${x2} ${y}
                A ${leftRx} ${leftRy} 0 0 1 ${x2} ${y2}`,
            );

            return c;
        });
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
