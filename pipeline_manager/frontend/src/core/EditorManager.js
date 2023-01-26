import { Editor } from '@baklavajs/core';
import { ViewPlugin } from '@baklavajs/plugin-renderer-vue';
import { OptionPlugin } from '@baklavajs/plugin-options-vue';
import { InterfaceTypePlugin } from '@baklavajs/plugin-interface-types';
import NodeFactory from '../core/NodeFactory';
import ListOption from '../options/ListOption.vue';

export default class EditorManager {
    editor = new Editor();
    viewPlugin = new ViewPlugin();
    nodeInterfaceTypes = new InterfaceTypePlugin();
    optionPlugin = new OptionPlugin();

    constructor() {
        this.initializeEditor()
        this.viewPlugin.registerOption('ListOption', ListOption);
    }

    initializeEditor() {
        this.editor.use(this.viewPlugin);
        this.editor.use(this.nodeInterfaceTypes);
        this.editor.use(this.optionPlugin);
    }

    updateEditorSpecification(dataflowSpecification) {
        if (!dataflowSpecification) return;

        this.editor = new Editor();
        this.initializeEditor();

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
            metadata.interfaces.forEach((name, color) => {
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