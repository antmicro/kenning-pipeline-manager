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
        <baklava-editor class="inner-editor" :plugin="this.editorManager.viewPlugin"/>
    </div>
</template>

<script>
import { backendApiUrl } from '../core/utils';
import EditorManager from '../core/EditorManager';

export default {
    data() {
        return {
            specificationLoaded: false,
            externalApplicationConnected: false,
            editorManager: new EditorManager(),
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
            };

            fetch(`${backendApiUrl}/load_specification`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    if (obj.response.ok) {
                        this.editorManager.updateEditorSpecification(JSON.parse(obj.data));
                        this.specificationLoaded = true;
                    } else {
                        /* eslint-disable no-alert */
                        alert(obj.data);
                    }
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
                    } else {
                        /* eslint-disable no-alert */
                        alert(obj.data);
                    }
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
                    if (obj.response.ok) {
                        this.editorManager.updateEditorSpecification(JSON.parse(obj.data));
                        this.specificationLoaded = true;
                    } else if (obj.response.status === 503) {
                        alert(obj.data);
                        this.externalApplicationConnected = false;
                    } else {
                        /* eslint-disable no-alert */
                        alert(obj.data);
                    }
                });
        },
        /**
         * Event handler that that saves a current dataflow to a `save.json` file.
         * It is also displayed in the console log.
         */
        save_dataflow() {
            const blob = new Blob([JSON.stringify(this.editorManager.saveDataflow())], { type: 'application/json' });
            const temp = document.createElement('a');
            temp.href = window.URL.createObjectURL(blob);
            temp.download = 'save';
            temp.click();
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

            fetch(`${backendApiUrl}/load_dataflow`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    if (obj.response.ok) {
                        this.editorManager.loadDataflow(JSON.parse(obj.data));
                    } else {
                        /* eslint-disable no-alert */
                        alert(obj.data);
                    }
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
            };

            fetch(`${backendApiUrl}/dataflow_action_request/${action}`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    alert(obj.data);
                    if (obj.response.status === 503) {
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
            };

            fetch(`${backendApiUrl}/import_dataflow`, requestOptions)
                .then((response) => response.text().then(
                    (data) => ({ response, data }),
                ))
                .then((obj) => {
                    if (obj.response.ok) {
                        this.editorManager.loadDataflow(JSON.parse(obj.data));
                    } else if (obj.response.status === 503) {
                        // Service Unavailable, which means
                        // that the external application was disconnected
                        alert(obj.data);
                        this.externalApplicationConnected = false;
                    } else {
                        /* eslint-disable no-alert */
                        alert(obj.data);
                    }
                });
        },
    },
};
</script>
