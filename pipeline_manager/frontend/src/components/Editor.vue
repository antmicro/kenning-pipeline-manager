<template>
    <div id="container">
        <div style="height: 80vh; width: 100vw">
            <baklava-editor :plugin="viewPlugin" />
            <button @click="save_dataflow">Save</button>
            <label for="load-dataflow-button">Load dataflow: </label>
                <input
                    type="file"
                    id="load-dataflow-button"
                    @change="load_dataflow"
                >
        </div>
    </div>
</template>

<script>
import { Editor } from "@baklavajs/core";
import { ViewPlugin } from "@baklavajs/plugin-renderer-vue";
import { OptionPlugin } from "@baklavajs/plugin-options-vue";
import { InterfaceTypePlugin } from "@baklavajs/plugin-interface-types";
import { NodeFactory } from "../core/NodeFactory.js"
import ListOption from "../options/ListOption.vue"

export default {
    props: [
        'dataflowSpecification'
    ],
    data() {
        return {
            editor: new Editor(),
            viewPlugin: new ViewPlugin(),
            nodeInterfaceTypes: new InterfaceTypePlugin(),
            optionPlugin: new OptionPlugin()
        };
    },
    created() {
        this.editor.use(this.viewPlugin);
        this.editor.use(this.nodeInterfaceTypes);
        this.editor.use(this.optionPlugin);
        this.viewPlugin.registerOption("ListOption", ListOption);
    },
    watch: {
        dataflowSpecification() {
            this.updateEditor();
        }
    },
    methods: {
        updateEditor() {
            if (!this.dataflowSpecification) return;

            const nodes = this.dataflowSpecification["nodes"];
            nodes.forEach(node => {
                const myNode = NodeFactory(node["name"], node["name"], node["inputs"], node["properties"], node["outputs"]);
                this.editor.registerNodeType(node["name"], myNode, node["category"]);
            });
        },
        save_dataflow() {
            const blob = new Blob([JSON.stringify(this.editor.save())], { type: 'application/json' });
            const temp = document.createElement('a');
            temp.href = window.URL.createObjectURL(blob);
            temp.download = 'save';
            temp.click();
            console.log(JSON.stringify(this.editor.save()))
        },
        load_dataflow() {
            let file = document.getElementById('load-dataflow-button').files[0];
            if (!file) return;

            let formData = new FormData();
            formData.append('dataflow', file);

            let requestOptions = {
                method: 'POST',
                body: formData
            };

            fetch('http://127.0.0.1:5000/load_dataflow', requestOptions)
                .then(response => response.text().then(data => ({status: response.status, data: data})))
                .then(obj => {
                    if (obj.status == 200) {
                        this.editor.load(JSON.parse(obj.data));
                    }
                    else if (obj.status == 400) {
                        alert(obj.data);
                    }
                });
        }
    }
};
</script>
