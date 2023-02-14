<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div id="container" class="outer">
        <div v-show="!editorManager.specificationLoaded">
            <label
                for="load-spec-button"
                >
                Load specification
            </label>
            <input
                
                type="file"
                id="load-spec-button"
                @change="loadSpecification"
            >
        </div>
        <div v-show="editorManager.specificationLoaded">
            <label
                for="load-dataflow-button"
                >
                Load dataflow
            </label>
            <input
                
                type="file"
                id="load-dataflow-button"
                @change="loadDataflow"
            >
            <input
                
                type="button"
                value="Save dataflow"
                @click="saveDataflow"
            >
        </div>
        <DelegatePanel></DelegatePanel>
        <baklava-editor
            class="inner-editor"
            :plugin="this.editorManager.viewPlugin"
        />
        <AlertBar
            ref="alertBar"
        />
    </div>
</template>

<script>
import EditorManager from '../core/EditorManager';
import AlertBar from './AlertBar.vue';
import DelegatePanel from './DelegatePanel.vue';

export default {
    components: {
        AlertBar,
        DelegatePanel,
    },
    data() {
        return {
            editorManager: EditorManager.getEditorManagerInstance(),
        };
    },
    methods: {
        /**
         * Event handler that loads a specification passed by the user
         * and asks the validates it.
         * If the validation is successful it is passed to the editor that
         * renders a new environment.
         * Otherwise user is alerted with a feedback message.
         */
        loadSpecification() {
            const file = document.getElementById('load-spec-button').files[0];
            if (!file) return;

            const fileReader = new FileReader();

            fileReader.onload = () => {
                let specification = null;
                try {
                    specification = JSON.parse(fileReader.result);
                } catch (exception) {
                    if (exception instanceof SyntaxError) {
                        this.$refs.alertBar.displayAlert(`Not a proper JSON file.\n${exception}`);
                    } else {
                        this.$refs.alertBar.displayAlert(`Unknown error.\n${exception}`);
                    }
                    return;
                }

                let returnMessage = this.editorManager.validateSpecification(specification);
                if (returnMessage === null) {
                    this.editorManager.updateEditorSpecification(specification);
                    returnMessage = 'Loaded successfully';
                }
                this.$refs.alertBar.displayAlert(returnMessage);
            };

            fileReader.readAsText(file);
        },
        /**
         * Event handler that Loads a dataflow from a file.
         * It the loading is successful it is loaded as the current dataflow.
         * Otherwise the user is alerted with a feedback message.
         */
        loadDataflow() {
            const file = document.getElementById('load-dataflow-button').files[0];
            if (!file) return;

            const fileReader = new FileReader();

            fileReader.onload = () => {
                let dataflow = null;
                try {
                    dataflow = JSON.parse(fileReader.result);
                } catch (exception) {
                    if (exception instanceof SyntaxError) {
                        this.$refs.alertBar.displayAlert(`Not a proper JSON file.\n${exception}`);
                    } else {
                        this.$refs.alertBar.displayAlert(`Unknown error.\n${exception}`);
                    }
                    return;
                }

                // TODO: Create schema for dataflows, as baklavajs does not provide any.
                this.editorManager.loadDataflow(dataflow);
                this.$refs.alertBar.displayAlert('Dataflow loaded successfully');
            };

            fileReader.readAsText(file);
        },
        /**
         * Event handler that that saves a current dataflow to a `save.json` file.
         */
        saveDataflow() {
            const blob = new Blob([JSON.stringify(this.editorManager.saveDataflow())], { type: 'application/json' });
            const linkElement = document.createElement('a');
            linkElement.href = window.URL.createObjectURL(blob);
            linkElement.download = 'save';
            linkElement.click();
            this.$refs.alertBar.displayAlert('Dataflow saved');
        },
    },
};
</script>
