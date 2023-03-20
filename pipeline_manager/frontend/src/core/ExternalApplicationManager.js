/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { backendApiUrl, HTTPCodes, PMMessageType } from './utils';
import { fetchGET, fetchPOST } from './fetchRequests';
import { alertBus } from './bus';
import EditorManager from './EditorManager';

export default class ExternalApplicationManager {
    externalApplicationConnected = false;

    backendAvailable = backendApiUrl !== null;

    editorManager = EditorManager.getEditorManagerInstance();

    idStatusInterval = null;

    timeoutStatusInterval = 500;

    /**
     * Event handler that asks the backend to open a TCP socket that can be connected to.
     * If the external application did not connect the user is alertd with a feedback message.
     */
    async openTCP() {
        const response = await fetchGET('connect');
        const data = await response.text();
        if (response.ok) {
            this.externalApplicationConnected = true;
        }
        alertBus.$emit('displayAlert', data);
    }

    /**
     * Event handler that asks the backend to send a dataflow specification.
     * If the backend did not manage to send it the user is alerted with a feedback message.
     * Otherwise the specification is passed to the editor that renders a new environment.
     */
    async requestSpecification() {
        const response = await fetchGET('request_specification');
        let message = 'Unknown error';

        if (response.status === HTTPCodes.OK) {
            const data = await response.json();

            if (data.type === PMMessageType.OK) {
                const specification = data.content;

                const errors = this.editorManager.validateSpecification(specification);
                if (Array.isArray(errors) && errors.length) {
                    message = errors;
                } else {
                    this.editorManager.updateEditorSpecification(specification);
                    message = 'Specification loaded successfully';
                }
            } else if (data.type === PMMessageType.ERROR) {
                message = data.content;
            }
        } else if (response.status === HTTPCodes.ServiceUnavailable) {
            message = await response.text();
        }

        alertBus.$emit('displayAlert', message);
    }

    /**
     * Event handler that loads a current dataflow from the editor and sends a request
     * to the backend based on the action argument.
     * The user is alerted with a feedback message.
     */
    async requestDataflowAction(action) {
        const dataflow = JSON.stringify(this.editorManager.saveDataflow());
        if (!dataflow) return;

        if (action === 'run') {
            alertBus.$emit('displayAlert', 'Running dataflow', true);
        }

        const formData = new FormData();
        formData.append('dataflow', dataflow);

        const response = await fetchPOST(`dataflow_action_request/${action}`, formData);

        if (response.status === HTTPCodes.OK) {
            const data = await response.json();
            alertBus.$emit('displayAlert', data.content);
        }
        if (response.status === HTTPCodes.ServiceUnavailable) {
            const data = await response.text();
            alertBus.$emit('displayAlert', data);
        }
    }

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

        const response = await fetchPOST('import_dataflow', formData);
        let message = 'Imported dataflow';

        if (response.status === HTTPCodes.OK) {
            const data = await response.json();

            if (data.type === PMMessageType.OK) {
                const errors = this.editorManager.loadDataflow(data.content);
                if (Array.isArray(errors) && errors.length) {
                    message = errors;
                }
            } else if (data.type === PMMessageType.ERROR) {
                message = data.content;
            }
        } else if (response.status === HTTPCodes.ServiceUnavailable) {
            const data = await response.text();
            message = data.content;
        }

        alertBus.$emit('displayAlert', message);
    }

    /**
     * Function that is used by setInterval() to periodically check the status
     * of the TCP connection. If the connection is not alive, then `initializeConnection`
     * is invoked.
     */
    async checkStatus() {
        const response = await fetchGET('get_status');
        if (response.status === HTTPCodes.ServiceUnavailable) {
            await this.invokeFetchAction(this.initializeConnection);
        }
    }

    /**
     * Wraps fetch functions and stops status checking before creating a fetch request.
     * After processing the request, the status checking is restored.
     * This function should be used to call any action with fetch request in it.
     */
    async invokeFetchAction(fetchCall, ...args) {
        this.stopStatusInterval();
        await fetchCall.apply(this, args);
        this.startStatusInterval();
    }

    /**
     * Starts status checking if it is not started.
     */
    startStatusInterval() {
        if (this.idStatusInterval === null) {
            this.idStatusInterval = setInterval(
                () => this.checkStatus(),
                this.timeoutStatusInterval,
            );
        }
    }

    /**
     * Stops status checking if it is running.
     */
    stopStatusInterval() {
        if (this.idStatusInterval !== null) {
            clearInterval(this.idStatusInterval);
            this.idStatusInterval = null;
        }
    }

    /**
     * Function used to initialize connection with the external application and request
     * specification. Should be called after DOM is created.
     */
    async initializeConnection() {
        this.externalApplicationConnected = false;
        alertBus.$emit('displayAlert', 'Waiting for the application to connect...', true);

        await this.invokeFetchAction(this.openTCP);
        if (this.externalApplicationConnected) {
            await this.invokeFetchAction(this.requestSpecification);
        }
    }
}
