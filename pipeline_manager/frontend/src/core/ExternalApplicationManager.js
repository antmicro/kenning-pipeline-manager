/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { backendApiUrl, HTTPCodes } from './utils';
import { fetchGET, fetchPOST } from './fetchRequests';
import { alertBus } from './bus';
import EditorManager from './EditorManager';

export default class ExternalApplicationManager {
    externalApplicationConnected = false;

    backendAvailable = (backendApiUrl !== null);

    editorManager = EditorManager.getEditorManagerInstance();

    idStatusInterval = null;

    timeoutStatusInterval = 1000;

    /**
     * Event handler that asks the backend to open a TCP socket that can be connected to.
     * If the external application did not connect the user is alertd with a feedback message.
     */
    async openTCP() {
        this.stopStatusInterval();

        const response = await fetchGET('connect');
        const data = await response.text();
        if (response.ok) {
            this.externalApplicationConnected = true;
        }
        alertBus.$emit('displayAlert', data);

        this.startStatusInterval();
    }

    /**
     * Event handler that asks the backend to send a dataflow specification.
     * If the backend did not manage to send it the user is alerted with a feedback message.
     * Otherwise the specification is passed to the editor that renders a new environment.
     */
    async requestSpecification() {
        this.stopStatusInterval();

        const response = await fetchGET('request_specification');
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

        this.startStatusInterval();
    }

    /**
     * Event handler that loads a current dataflow from the editor and sends a request
     * to the backend based on the action argument.
     * The user is alerted with a feedback message.
     */
    async requestDataflowAction(action) {
        this.stopStatusInterval();

        const dataflow = JSON.stringify(this.editorManager.saveDataflow());
        if (!dataflow) return;

        if (action === 'run') {
            alertBus.$emit('displayAlert', 'Running dataflow', true);
        }

        const formData = new FormData();
        formData.append('dataflow', dataflow);

        const response = await fetchPOST(
            `dataflow_action_request/${action}`,
            formData
        );
        const data = await response.text();

        alertBus.$emit('displayAlert', data);
        if (response.status === HTTPCodes.ServiceUnavailable) {
            // Service Unavailable, which means
            // that the external application was disconnected
            this.externalApplicationConnected = false;
        }
        
        this.startStatusInterval();
    }

    /**
     * Event handler that loads a file and asks the backend to delegate this operation
     * to the external application to parse it into the Pipeline Manager format
     * so that it can be loaded into the editor.
     * It the validation is successful it is loaded as the current dataflow.
     * Otherwise the user is alerted with a feedback message.
     */
    async importDataflow() {
        this.stopStatusInterval();

        const file = document.getElementById('request-dataflow-button').files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('external_application_dataflow', file);

        const response = await fetchPOST('import_dataflow', formData);
        const data = await response.text();

        let message = 'Imported dataflow';

        if (response.status === HTTPCodes.OK) {
            const errors = this.editorManager.loadDataflow(JSON.parse(data));
            if (Array.isArray(errors) && errors.length) {
                message = errors;
            }
        } else if (response.status === HTTPCodes.ServiceUnavailable) {
            // Service Unavailable, which means
            // that the external application was disconnected
            message = data;
            this.externalApplicationConnected = false;
        } else if (response.status === HTTPCodes.BadRequest) {
            message = data;
        }
        alertBus.$emit('displayAlert', message);
        
        this.startStatusInterval();
    }

    async printStatus() {
        const response = await fetchGET('get_status');
        if (response.status == HTTPCodes.ServiceUnavailable) {
            this.initializeConnection();
        }
    }

    startStatusInterval() {
        if (this.idStatusInterval === null) {
            this.idStatusInterval = setInterval(() => this.printStatus(), this.timeoutStatusInterval);
        }
    }

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

        await this.openTCP();

        if (this.externalApplicationConnected) {
            await this.requestSpecification();
        }
    }
}
