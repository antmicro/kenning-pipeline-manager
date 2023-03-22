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
     * Function that fetches state of the connection and updates
     * `this.externalApplicationConnected` property.
     */
    async updateConnectionStatus() {
        const response = await fetchGET('get_status');
        this.externalApplicationConnected = response.status === HTTPCodes.OK;
    }

    /**
     * Event handler that asks the backend to open a TCP socket that can be connected to.
     * If the external application did not connect the user is alertd with a feedback message.
     * This function updates `this.externalApplicationConnected` property
     */
    async openTCP() {
        const response = await fetchGET('connect');
        const data = await response.text();
        const connected = response.status === HTTPCodes.OK;

        if (!connected) {
            alertBus.$emit('displayAlert', data);
        }
        this.externalApplicationConnected = connected;
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
     *
     * @param action Type of the requested action.
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
            // The connection was closed
            const data = await response.text();
            alertBus.$emit('displayAlert', data);
            this.externalApplicationConnected = false;
            await this.invokeFetchAction(this.initializeConnection, false);
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
            // The connection was closed
            const data = await response.text();
            message = data.content;
            this.externalApplicationConnected = false;
            await this.invokeFetchAction(this.initializeConnection, false);
        }

        alertBus.$emit('displayAlert', message);
    }

    /**
     * Function that is used by setInterval() to periodically check the status
     * of the TCP connection. If the connection is not alive, then `initializeConnection`
     * is invoked.
     */
    async checkConnectionStatus() {
        await this.updateConnectionStatus();
        if (!this.externalApplicationConnected) {
            await this.invokeFetchAction(this.initializeConnection, false);
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
     * Starts status checking.
     */
    startStatusInterval() {
        if (this.idStatusInterval === null) {
            this.idStatusInterval = setInterval(
                () => this.checkConnectionStatus(),
                this.timeoutStatusInterval,
            );
        }
    }

    /**
     * Stops status checking.
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
     *
     * It checks whether a connection is established.
     * If it is then it just requests a specification.
     * If it is not then it opens a TCP port, wait for the application to connect and then
     * requests specification.
     *
     * @param checkConnection True if should check connection status beforehand. Used to reduce
     * the number of requests if the status of the connection is known.
     */
    async initializeConnection(checkConnection = true) {
        if (checkConnection) {
            await this.updateConnectionStatus();
        }

        if (!this.externalApplicationConnected) {
            alertBus.$emit('displayAlert', 'Waiting for the application to connect...', true);
            await this.openTCP();
        }
        if (this.externalApplicationConnected) {
            await this.requestSpecification();
        }
    }
}
