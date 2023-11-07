/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { backendApiUrl, PMMessageType } from '../utils';
import jsonRPC from './rpcCommunication';
import { runInfo } from './remoteProcedures';
import NotificationHandler from '../notifications';
import EditorManager from '../EditorManager';

class ExternalApplicationManager {
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
        try {
            const response = await jsonRPC.request('get_status');
            this.externalApplicationConnected = response.status.connected;
        } catch (error) {
            NotificationHandler.terminalLog('error', error.message);
            this.externalApplicationConnected = false;
        }
    }

    /**
     * Event handler that asks the backend to open a TCP socket that can be connected to.
     * If the external application did not connect the user is alertd with a feedback message.
     * This function updates `this.externalApplicationConnected` property
     */
    async openTCP() {
        try {
            await jsonRPC.request('external_app_connect');
            this.externalApplicationConnected = true;
        } catch (error) {
            NotificationHandler.terminalLog('error', error.message);
            this.externalApplicationConnected = false;
        }
    }

    /**
     * Event handler that asks the backend to send a dataflow specification.
     * If the backend did not manage to send it the user is alerted with a feedback message.
     * Otherwise the specification is passed to the editor that renders a new environment.
     */
    async requestSpecification() {
        let message = 'Unknown error';
        try {
            const data = await jsonRPC.request('request_specification');

            if (data.type === PMMessageType.OK) {
                const specification = data.content;

                let { errors, warnings } = this.editorManager.validateSpecification(specification);
                if (Array.isArray(errors) && errors.length) {
                    NotificationHandler.terminalLog('error', 'Specification is invalid', errors);
                    return;
                }
                ({ errors, warnings } =
                    this.editorManager.updateEditorSpecification(specification));
                if (Array.isArray(warnings) && warnings.length) {
                    NotificationHandler.terminalLog(
                        'warning',
                        'Warnings when loading specification',
                        warnings,
                    );
                }

                NotificationHandler.showToast('info', 'Specification loaded successfully');
            } else if (data.type === PMMessageType.WARNING) {
                message = data.content;
                NotificationHandler.terminalLog('warning', message);
            } else if (data.type === PMMessageType.ERROR) {
                message = data.content;
                NotificationHandler.terminalLog('error', message);
            }
        } catch (error) {
            message = error.message;
            NotificationHandler.terminalLog('error', message);
        }
    }

    /**
     * Event handler that loads a current dataflow from the editor and sends a request
     * to the backend based on the action argument.
     * The user is alerted with a feedback message.
     *
     * @param action Type of the requested action.
     */
    async requestDataflowAction(action) {
        const dataflow = this.editorManager.saveDataflow();
        const progressBar = document.querySelector('.progress-bar');
        if (!dataflow) return;

        if (action === 'run') {
            if (runInfo.inProgress) {
                NotificationHandler.showToast('error', 'Previous run has not finished, cannot process this request');
                return;
            }
            runInfo.inProgress = true;
            NotificationHandler.showToast('info', 'Running dataflow');
            progressBar.style.width = '0%';
        }

        if (action === 'stop') {
            if (!runInfo.inProgress) {
                NotificationHandler.showToast('error', 'Nothing to stop, no ongoing jobs running');
                return;
            }
            NotificationHandler.showToast('info', 'Stopping dataflow');
        }

        let data;
        try {
            if (action !== 'stop') {
                data = await jsonRPC.request(`${action}_dataflow`, { dataflow });
            } else {
                data = await jsonRPC.request(`${action}_dataflow`);
            }
        } catch (error) {
            // The connection was closed
            data = error.message;
            NotificationHandler.terminalLog('error', data);
            if (action === 'run') {
                progressBar.style.width = '0%';
                runInfo.inProgress = false;
            }
            return;
        }

        // Status is HTTPCodes.OK so a message from the application is received.
        if (data.type === PMMessageType.OK) {
            NotificationHandler.showToast('info', data.content);
        } else if (data.type === PMMessageType.ERROR) {
            NotificationHandler.terminalLog('error', `Error occured: ${data.content}`, data.content);
        } else if (data.type === PMMessageType.WARNING) {
            NotificationHandler.terminalLog('warning', `Warning: ${data.content}`, data.content);
        }
        if (action === 'run' || action === 'stop') {
            progressBar.style.width = '0%';
            runInfo.inProgress = false;
        }
    }

    /**
     * Event handler that loads a file and asks the backend to delegate this operation
     * to the external application to parse it into the Pipeline Manager format
     * so that it can be loaded into the editor.
     * It the validation is successful it is loaded as the current dataflow.
     * Otherwise the user is alerted with a feedback message.
     *
     * @param dataflow Dataflow to be impported
     */
    async importDataflow() {
        const file = document.getElementById('request-dataflow-button').files[0];
        if (!file) return;

        const dataflow = JSON.parse(await file.text());
        if (!dataflow) {
            NotificationHandler.showToast('error', 'File cannot be loaded');
            return;
        }

        try {
            const data = await jsonRPC.request('import_dataflow', { external_application_dataflow: dataflow });
            if (data.type === PMMessageType.OK) {
                const errors = await this.editorManager.loadDataflow(data.content);
                if (Array.isArray(errors) && errors.length) {
                    NotificationHandler.terminalLog('error', 'Dataflow is invalid', errors);
                } else {
                    NotificationHandler.showToast('info', 'Imported dataflow');
                }
            } else if (data.type === PMMessageType.ERROR) {
                const message = data.content;
                NotificationHandler.terminalLog('error', `Error occured: ${data.content}`, message);
            } else if (data.type === PMMessageType.WARNING) {
                NotificationHandler.terminalLog('warning', `Warning: ${data.content}`, 'Imported dataflow');
            }
        } catch (error) {
            const data = error.message;
            NotificationHandler.terminalLog('error', data);
        }
    }

    /**
     * Function that is used by setInterval() to periodically check the status
     * of the TCP connection. If the connection is not alive, then `initializeConnection`
     * is invoked.
     */
    async checkConnectionStatus() {
        await this.updateConnectionStatus();
        if (!this.externalApplicationConnected) {
            this.stopStatusInterval();
            await this.initializeConnection(false);
        }
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
            NotificationHandler.showToast('info', 'Waiting for the application to connect...');
            await this.openTCP();
        }
        if (this.externalApplicationConnected) {
            await this.requestSpecification();
        }

        this.startStatusInterval();
    }
}

let externalApplicationManager;

export default function getExternalApplicationManager() {
    if (!externalApplicationManager) externalApplicationManager = new ExternalApplicationManager();
    return externalApplicationManager;
}
