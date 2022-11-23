<template>
    <div id="container">
        <div style="height: 80vh; width: 100vw">
            <baklava-editor :plugin="viewPlugin" />
            <button @click="save_dataflow">Save dataflow</button>
            <label for="load-dataflow-button">Load dataflow: </label>
                <input
                    type="file"
                    id="load-dataflow-button"
                    @change="load_dataflow"
                >
            <button @click="request_validation">Validate dataflow</button>
            <button @click="request_run">Run dataflow</button>
        </div>
    </div>
</template>

<script>
import { Editor } from '@baklavajs/core';
import { ViewPlugin } from '@baklavajs/plugin-renderer-vue';
import { OptionPlugin } from '@baklavajs/plugin-options-vue';
import { InterfaceTypePlugin } from '@baklavajs/plugin-interface-types';
import NodeFactory from '../core/NodeFactory';
import ListOption from '../options/ListOption.vue';

export default {
    props: [
        /**
         * Dataflow specification of the current environment.
         */
        'dataflowSpecification',
    ],
    data() {
        return {
            editor: new Editor(),
            viewPlugin: new ViewPlugin(),
            nodeInterfaceTypes: new InterfaceTypePlugin(),
            optionPlugin: new OptionPlugin(),
        };
    },
    created() {
        this.editor.use(this.viewPlugin);
        this.editor.use(this.nodeInterfaceTypes);
        this.editor.use(this.optionPlugin);
        this.viewPlugin.registerOption('ListOption', ListOption);
    },
    watch: {
        dataflowSpecification() {
            this.updateEditor();
        },
    },
    methods: {
        /**
         * It is called when `dataflowSpecification` property is updated.
         * It creates a new environment for the editor.
         */
        updateEditor() {
            if (!this.dataflowSpecification) return;

            const { nodes } = this.dataflowSpecification;
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
        },
        /**
         * Event handler that that saves a current dataflow to a `save.json` file.
         * It is also displayed in the console log.
         */
        save_dataflow() {
            const blob = new Blob([JSON.stringify(this.editor.save())], { type: 'application/json' });
            const temp = document.createElement('a');
            temp.href = window.URL.createObjectURL(blob);
            temp.download = 'save';
            temp.click();
            /* eslint-disable no-console */
            console.log(JSON.stringify(this.editor.save()));
        },
        /**
         * Event handler that Loads a dataflow from a file and asks the backend to validate it.
         * It the validation is successful it is loaded as the current dataflow.
         * Otherwise the user is alerted with a feedback message.
         */
        load_dataflow() {
            const file = document.getElementById('load-dataflow-button').files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('dataflow', file);

            const requestOptions = {
                method: 'POST',
                body: formData,
            };

            fetch('http://127.0.0.1:5000/load_dataflow', requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    if (obj.response.ok) {
                        this.editor.load(JSON.parse(obj.data));
                    } else {
                        /* eslint-disable no-alert */
                        alert(obj.data);
                    }
                });
        },
        /**
         * Event handler that loads a current dataflow from the editor and sends a request
         * to the backend to validate the dataflow.
         * The user is alerted with a feedback message.
         */
        request_validation() {
            const dataflow = JSON.stringify(this.editor.save());
            if (!dataflow) return;

            const formData = new FormData();
            formData.append('dataflow', dataflow);

            const requestOptions = {
                method: 'POST',
                body: formData,
            };

            fetch('http://127.0.0.1:5000/dataflow_action_request/validate', requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    /* eslint-disable no-alert */
                    alert(obj.data);
                });
        },
        /**
         * Event handler that loads a current dataflow from the editor and sends a request
         * to the backend to run the dataflow.
         * The user is alerted with a feedback message.
         */
        request_run() {
            const dataflow = JSON.stringify(this.editor.save());
            if (!dataflow) return;

            const formData = new FormData();
            formData.append('dataflow', dataflow);

            const requestOptions = {
                method: 'POST',
                body: formData,
            };

            fetch('http://127.0.0.1:5000/dataflow_action_request/run', requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    /* eslint-disable no-alert */
                    alert(obj.data);
                });
        },
    },
};
</script>
