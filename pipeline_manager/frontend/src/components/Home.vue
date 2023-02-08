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
                @change="load_specification"
            >
            <input
                v-show="!externalApplicationConnected"
                type="button"
                value="Open TCP connection"
                @click="open_tcp"
            >
            <input
                v-show="!specificationLoaded"
                type="button"
                value="Request specification"
                @click="request_specification"
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
                @change="load_dataflow"
            >
            <label
                for="request-dataflow-button"
                v-show="specificationLoaded">Import dataflow
            </label>
            <input
                v-show="specificationLoaded"
                type="file"
                id="request-dataflow-button"
                @change="import_dataflow"
            >
            <input
                v-show="specificationLoaded"
                type="button"
                value="Save dataflow"
                @click="save_dataflow"
            >
            <input
                v-show="externalApplicationConnected"
                type="button"
                value="Export dataflow"
                @click="request_dataflow_action('export')"
            >
            <input
                v-show="externalApplicationConnected"
                type="button"
                value="Validate dataflow"
                @click="request_dataflow_action('validate')"
            >
            <input
                v-show="externalApplicationConnected"
                type="button"
                value="Run dataflow"
                @click="request_dataflow_action('run')"
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
        load_specification() {
            const file = document.getElementById('load-spec-button').files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('specfile', file);

            const requestOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'Access-Control-Allow-Origin': '*',
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
        open_tcp() {
            fetch(`${backendApiUrl}/connect`)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    if (obj.response.ok) {
                        this.externalApplicationConnected = true;
                    }
                    this.display_alert(obj.data);
                });
        },
        /**
         * Event handler that asks the backend to send a dataflow specification.
         * If the backend did not manage to send it the user is alerted with a feedback message.
         * Otherwise the specification is passed to the editor that renders a new environment.
         */
        request_specification() {
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
                    this.display_alert(message);
                });
        },
        /**
         * Event handler that that saves a current dataflow to a `save.json` file.
         * It is also displayed in the console log.
         */
        save_dataflow() {
            const blob = new Blob([JSON.stringify(this.editorManager.saveDataflow())], { type: 'application/json' });
            const link_element = document.createElement('a');
            link_element.href = window.URL.createObjectURL(blob);
            link_element.download = 'save';
            link_element.click();
            this.display_alert('Dataflow saved');
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
                headers: {
                    'Access-Control-Allow-Origin': '*',
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
                    this.display_alert(message);
                });
        },
        /**
         * Event handler that loads a current dataflow from the editor and sends a request
         * to the backend based on the action argument.
         * The user is alerted with a feedback message.
         */
        request_dataflow_action(action) {
            const dataflow = JSON.stringify(this.editorManager.saveDataflow());
            if (!dataflow) return;

            const formData = new FormData();
            formData.append('dataflow', dataflow);

            const requestOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
                },
            };

            if (action === 'run') {
                this.display_alert('Running dataflow', true);
            }

            fetch(`${backendApiUrl}/dataflow_action_request/${action}`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    this.display_alert(obj.data);
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
        import_dataflow() {
            const file = document.getElementById('request-dataflow-button').files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('external_application_dataflow', file);

            const requestOptions = {
                method: 'POST',
                body: formData,
                headers: {
                    'Access-Control-Allow-Origin': '*',
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
                    this.display_alert(message);
                });
        },
        display_alert(alertText, loading = false) {
            this.alertText = alertText;
            this.alertVisible = true;
            this.loading = loading;
        },
    },
};
</script>
