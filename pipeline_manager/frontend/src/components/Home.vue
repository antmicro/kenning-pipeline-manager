<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div id="container" class="outer">
        <div>
            <label
                for="load-spec-button"
                v-show="!specificationLoaded">Load specification
            </label>
            <input
                v-show="!specificationLoaded"
                type="file"
                id="load-spec-button"
                @change="loadSpecification"
            >
            <input
                v-show="!externalApplicationConnected"
                type="button"
                value="Open TCP connection"
                @click="openTCP"
            >
            <input
                v-show="!specificationLoaded"
                type="button"
                value="Request specification"
                @click="requestSpecification"
            >
        </div>
        <div>
            <label
                for="load-dataflow-button"
                v-show="specificationLoaded">Load dataflow
            </label>
            <input
                v-show="specificationLoaded"
                type="file"
                id="load-dataflow-button"
                @change="loadDataflow"
            >
            <label
                for="request-dataflow-button"
                v-show="specificationLoaded">Import dataflow
            </label>
            <input
                v-show="specificationLoaded"
                type="file"
                id="request-dataflow-button"
                @change="importDataflow"
            >
            <input
                v-show="specificationLoaded"
                type="button"
                value="Save dataflow"
                @click="saveDataflow"
            >
            <input
                v-show="externalApplicationConnected"
                type="button"
                value="Export dataflow"
                @click="requestDataflowAction('export')"
            >
            <input
                v-show="externalApplicationConnected"
                type="button"
                value="Validate dataflow"
                @click="requestDataflowAction('validate')"
            >
            <input
                v-show="externalApplicationConnected"
                type="button"
                value="Run dataflow"
                @click="requestDataflowAction('run')"
            >
        </div>
        <baklava-editor
            class="inner-editor"
            :plugin="this.editorManager.viewPlugin"
        />
        <AlertBar
            v-model="alertVisible"
            v-show="alertVisible"
            :alert-text="alertText"
            :loading="loading"
        />
    </div>
</template>

<script>
import { backendApiUrl, HTTPCodes } from '../core/utils';
import EditorManager from '../core/EditorManager';
import AlertBar from './AlertBar.vue';

export default {
    components: {
        AlertBar,
    },
    data() {
        return {
            editorManager: new EditorManager(),
            specificationLoaded: false,
            externalApplicationConnected: false,

            alertVisible: false,
            alertText: '',
            loading: false,
        };
    },
    methods: {
        /**
         * Event handler that loads a specification passed by the user
         * and asks the backend to validate it.
         * If the validation is successful it is passed to the editor that
         * renders a new environment.
         * Otherwise user is alerted with a feedback message.
         */
        loadSpecification() {
            const file = document.getElementById('load-spec-button').files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('specfile', file);

            const requestOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'Access-Control-Allow-Origin': backendApiUrl,
                    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                },
            };

            fetch(`${backendApiUrl}/load_specification`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    let message = 'Specification loaded';
                    if (obj.response.ok) {
                        this.editorManager.updateEditorSpecification(JSON.parse(obj.data));
                        this.specificationLoaded = true;
                    } else {
                        message = obj.data;
                    }
                    this.display_alert(message);
                });
        },
        /**
         * Event handler that asks the backend to open a TCP socket that can be connected to.
         * If the external application did not connect the user is alertd with a feedback message.
         */
        openTCP() {
            fetch(`${backendApiUrl}/connect`)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    if (obj.response.ok) {
                        this.externalApplicationConnected = true;
                    }
                    this.displayAlert(obj.data);
                });
        },
        /**
         * Event handler that asks the backend to send a dataflow specification.
         * If the backend did not manage to send it the user is alerted with a feedback message.
         * Otherwise the specification is passed to the editor that renders a new environment.
         */
        requestSpecification() {
            fetch(`${backendApiUrl}/request_specification`)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    let message = 'Specification loaded';
                    if (obj.response.status === HTTPCodes.OK) {
                        this.editorManager.updateEditorSpecification(JSON.parse(obj.data));
                        this.specificationLoaded = true;
                    } else if (obj.response.status === HTTPCodes.ServiceUnavailable) {
                        message = obj.data;
                        this.externalApplicationConnected = false;
                    } else if (obj.response.status === HTTPCodes.BadRequest) {
                        message = obj.data;
                    }
                    this.displayAlert(message);
                });
        },
        /**
         * Event handler that that saves a current dataflow to a `save.json` file.
         * It is also displayed in the console log.
         */
        saveDataflow() {
            const blob = new Blob([JSON.stringify(this.editorManager.saveDataflow())], { type: 'application/json' });
            const linkElement = document.createElement('a');
            linkElement.href = window.URL.createObjectURL(blob);
            linkElement.download = 'save';
            linkElement.click();
            this.displayAlert('Dataflow saved');
        },
        /**
         * Event handler that Loads a dataflow from a file and asks the backend to validate it.
         * It the validation is successful it is loaded as the current dataflow.
         * Otherwise the user is alerted with a feedback message.
         */
        loadDataflow() {
            const file = document.getElementById('load-dataflow-button').files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('dataflow', file);

            const requestOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'Access-Control-Allow-Origin': backendApiUrl,
                    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                },
            };

            fetch(`${backendApiUrl}/load_dataflow`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    let message = 'Dataflow loaded';
                    if (obj.response.status === HTTPCodes.OK) {
                        this.editorManager.loadDataflow(JSON.parse(obj.data));
                    } else if (obj.response.status === HTTPCodes.BadRequest) {
                        message = obj.data;
                    }
                    this.displayAlert(message);
                });
        },
        /**
         * Event handler that loads a current dataflow from the editor and sends a request
         * to the backend based on the action argument.
         * The user is alerted with a feedback message.
         */
        requestDataflowAction(action) {
            const dataflow = JSON.stringify(this.editorManager.saveDataflow());
            if (!dataflow) return;

            const formData = new FormData();
            formData.append('dataflow', dataflow);

            const requestOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'Access-Control-Allow-Origin': backendApiUrl,
                    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                },
            };

            if (action === 'run') {
                this.displayAlert('Running dataflow', true);
            }

            fetch(`${backendApiUrl}/dataflow_action_request/${action}`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    this.displayAlert(obj.data);
                    if (obj.response.status === HTTPCodes.ServiceUnavailable) {
                        // Service Unavailable, which means
                        // that the external application was disconnected
                        this.externalApplicationConnected = false;
                    }
                });
        },
        /**
         * Event handler that loads a file and asks the backend to delegate this operation
         * to the external application to parse it into the Pipeline Manager format
         * so that it can be loaded into the editor.
         * It the validation is successful it is loaded as the current dataflow.
         * Otherwise the user is alerted with a feedback message.
         */
        importDataflow() {
            const file = document.getElementById('request-dataflow-button').files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('external_application_dataflow', file);

            const requestOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'Access-Control-Allow-Origin': backendApiUrl,
                    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                },
            };

            fetch(`${backendApiUrl}/import_dataflow`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    let message = 'Imported dataflow';
                    if (obj.response.status === HTTPCodes.OK) {
                        this.editorManager.loadDataflow(JSON.parse(obj.data));
                    } else if (obj.response.status === HTTPCodes.ServiceUnavailable) {
                        // Service Unavailable, which means
                        // that the external application was disconnected
                        message = obj.data;
                        this.externalApplicationConnected = false;
                    } else if (obj.response.status === HTTPCodes.BadRequest) {
                        message = obj.data;
                    }
                    this.displayAlert(message);
                });
        },
        displayAlert(alertText, loading = false) {
            this.alertText = alertText;
            this.alertVisible = true;
            this.loading = loading;
        },
    },
};
</script>
