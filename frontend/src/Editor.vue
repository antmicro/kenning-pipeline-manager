<template>
    <div style="height: 100vh; width: 100vw">
        <baklava-editor :plugin="viewPlugin" />
    </div>
</template>

<script>
import { Editor } from "@baklavajs/core";
import { ViewPlugin } from "@baklavajs/plugin-renderer-vue";
import { OptionPlugin } from "@baklavajs/plugin-options-vue";
import { InterfaceTypePlugin } from "@baklavajs/plugin-interface-types";
import { NodeFactory } from "./NodeFactory.js"
import { dataflow_example } from "./examples.js"

export default {
    data() {
        return {
            editor: new Editor(),
            viewPlugin: new ViewPlugin(),
            nodeInterfaceTypes: new InterfaceTypePlugin()
        };
    },
    created() {
        this.editor.use(this.viewPlugin);
        this.editor.use(this.nodeInterfaceTypes);
        this.editor.use(new OptionPlugin());
    },
    mounted() {
        const nodes = dataflow_example["nodes"];
        nodes.forEach(node => {
            const myNode = NodeFactory(node["name"], node["name"], node["inputs"],
                node["properties"], node["outputs"]);
            this.editor.registerNodeType(node["name"], myNode, node["category"]);
        })
        
        this.nodeInterfaceTypes.addType("Dataset", "#c0e4eb").addType("ModelWrapper", "#c0e4eb").addType("Runtime", "#c0e4eb");
    }
};
</script>
