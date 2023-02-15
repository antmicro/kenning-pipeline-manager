<template>
<div class="inner-row">
    <div v-show="!externalApplicationConnected">
        <input
            type="button"
            value="Open TCP connection"
            @click="openTCP"
        >
    </div>
    <div v-show="externalApplicationConnected">
        <input
            v-show="!editorManager.specificationLoaded "
            type="button"
            value="Request specification"
            @click="requestSpecification"
        >
        <label for="request-dataflow-button">
            Import dataflow
        </label>
        <input
            type="file"
            id="request-dataflow-button"
            @change="importDataflow"
        >
        <input
            type="button"
            value="Export dataflow"
            @click="requestDataflowAction('export')"
        >
        <input
            type="button"
            value="Validate dataflow"
            @click="requestDataflowAction('validate')"
        >
        <input
            type="button"
            value="Run dataflow"
            @click="requestDataflowAction('run')"
        >
    </div>
</div>
</template>

<script>
import EditorManager from '../core/EditorManager';
import { backendApiUrl, HTTPCodes } from '../core/utils';
import { alertBus } from '../core/bus';

export default {
    data() {
        return {
            editorManager: EditorManager.getEditorManagerInstance(),
            externalApplicationConnected: false,
        };
    },
    methods: {
        /**
         * Event handler that asks the backend to open a TCP socket that can be connected to.
         * If the external application did not connect the user is alertd with a feedback message.
         */
        async openTCP() {
            const response = await fetch(`${backendApiUrl}/connect`);
            const data = await response.text();
            if (response.ok) {
                this.externalApplicationConnected = true;
            }
            alertBus.$emit('displayAlert', data);
        },
        /**
         * Event handler that asks the backend to send a dataflow specification.
         * If the backend did not manage to send it the user is alerted with a feedback message.
         * Otherwise the specification is passed to the editor that renders a new environment.
         */
        async requestSpecification() {
            const response = await fetch(`${backendApiUrl}/request_specification`);
            const data = await response.text();
            let message = 'Specification loaded';

            if (response.status === HTTPCodes.OK) {
                this.editorManager.updateEditorSpecification(JSON.parse(data));
            } else if (response.status === HTTPCodes.ServiceUnavailable) {
                message = data;
                this.externalApplicationConnected = false;
            } else if (response.status === HTTPCodes.BadRequest) {
                message = data;
            }
            alertBus.$emit('displayAlert', message);
        },
        /**
         * Event handler that loads a current dataflow from the editor and sends a request
         * to the backend based on the action argument.
         * The user is alerted with a feedback message.
         */
        async requestDataflowAction(action) {
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
                alertBus.$emit('displayAlert', 'Running dataflow', true);
            }

            const response = await fetch(`${backendApiUrl}/dataflow_action_request/${action}`, requestOptions);
            const data = await response.text();

            alertBus.$emit('displayAlert', data);
            if (response.status === HTTPCodes.ServiceUnavailable) {
                // Service Unavailable, which means
                // that the external application was disconnected
                this.externalApplicationConnected = false;
            }
        },
        /**
         * Event handler that loads a file and asks the backend to delegate this operation
         * to the external application to parse it into the Pipeline Manager format
         * so that it can be loaded into the editor.
         * It the validation is successful it is loaded as the current dataflow.
         * Otherwise the user is alerted with a feedback message.
         */
        async importDataflow() {
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

            const response = await fetch(`${backendApiUrl}/import_dataflow`, requestOptions);
            const data = await response.text();
            let message = 'Imported dataflow';

            if (response.status === HTTPCodes.OK) {
                this.editorManager.loadDataflow(JSON.parse(data));
            } else if (response.status === HTTPCodes.ServiceUnavailable) {
                // Service Unavailable, which means
                // that the external application was disconnected
                message = data;
                this.externalApplicationConnected = false;
            } else if (response.status === HTTPCodes.BadRequest) {
                message = data;
            }
            alertBus.$emit('displayAlert', message);
        },
    },
};
</script>
