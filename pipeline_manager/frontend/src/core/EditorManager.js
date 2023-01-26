import { Editor } from '@baklavajs/core';
import { ViewPlugin } from '@baklavajs/plugin-renderer-vue';
import { OptionPlugin } from '@baklavajs/plugin-options-vue';
import { InterfaceTypePlugin } from '@baklavajs/plugin-interface-types';
import NodeFactory from './NodeFactory';
import ListOption from '../options/ListOption.vue';

export default class EditorManager {
    editor = new Editor();

    viewPlugin = new ViewPlugin();

    nodeInterfaceTypes = new InterfaceTypePlugin();

    optionPlugin = new OptionPlugin();

    usedSpecification = null;

    constructor() {
        this.editor.use(this.viewPlugin);
        this.editor.use(this.nodeInterfaceTypes);
        this.editor.use(this.optionPlugin);
        this.viewPlugin.registerOption('ListOption', ListOption);
    }

    updateEditorSpecification(dataflowSpecification) {
        if (!dataflowSpecification) return;

        this.usedSpecification = dataflowSpecification;
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
}
