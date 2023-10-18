/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { io } from 'socket.io-client';

import { backendApiUrl, HTTPCodes, PMMessageType } from './utils';
import NotificationHandler from './notifications';
import EditorManager from './EditorManager';

export default class ExternalApplicationManager {
    externalApplicationConnected = false;

    backendAvailable = backendApiUrl !== null;

    editorManager = EditorManager.getEditorManagerInstance();

    idStatusInterval = null;

    socket = null;

    timeoutStatusInterval = 500;

    constructor() {
        this.socket = io(backendApiUrl);

        this.socket.on('connect', () => NotificationHandler.terminalLog('info', 'Initialized connection with backend'));
        this.socket.on('disconnect', () => NotificationHandler.terminalLog('warning', 'Connection with backend disrupted'));
    }

    /**
     * Function that fetches state of the connection and updates
     * `this.externalApplicationConnected` property.
     */
    async updateConnectionStatus() {
        const response = await this.socket.emitWithAck('get_status');
        this.externalApplicationConnected = HTTPCodes.OK === response.status;
    }

    /**
     * Event handler that asks the backend to open a TCP socket that can be connected to.
     * If the external application did not connect the user is alertd with a feedback message.
     * This function updates `this.externalApplicationConnected` property
     */
    async openTCP() {
        const response = await this.socket.emitWithAck('external_app_connect');
        const connected = response.status === HTTPCodes.OK;

        if (!connected) {
            NotificationHandler.terminalLog('error', response.data);
        }
        this.externalApplicationConnected = connected;
    }

    /**
     * Event handler that asks the backend to send a dataflow specification.
     * If the backend did not manage to send it the user is alerted with a feedback message.
     * Otherwise the specification is passed to the editor that renders a new environment.
     */
    async requestSpecification() {
        const response = await this.socket.emitWithAck('request_specification');
        const { data, status } = response;

        if (status === HTTPCodes.OK) {
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
                const message = data.content;
                NotificationHandler.terminalLog('warning', message);
            } else if (data.type === PMMessageType.ERROR) {
                const message = data.content;
                NotificationHandler.terminalLog('error', message);
            }
        } else if (status === HTTPCodes.ServiceUnavailable) {
            NotificationHandler.terminalLog('error', data);
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
        const dataflow = JSON.stringify(this.editorManager.saveDataflow());
        if (!dataflow) return;

        if (action === 'run') {
            NotificationHandler.showToast('info', 'Running dataflow');
        }

        let { status, data } = await this.socket.emitWithAck('dataflow_action_request', action, dataflow);

        if (status === HTTPCodes.ServiceUnavailable) {
            // The connection was closed
            NotificationHandler.terminalLog('error', data);
            return;
        }

        // Status is HTTPCodes.OK so a message from the application is received.
        if (action === 'run') {
            const progressBar = document.querySelector('.progress-bar');
            progressBar.style.width = '0%';

            /* eslint-disable no-await-in-loop */
            while (data.type === PMMessageType.PROGRESS) {
                // Information about the progress
                const progress = data.content;
                progressBar.style.width = `${progress}%`;

                ({ status, data } = await this.socket.emitWithAck('receive_message'));
                if (status === HTTPCodes.ServiceUnavailable) {
                    NotificationHandler.terminalLog('error', data);
                    progressBar.style.width = '0%';
                    return;
                }
            }
            progressBar.style.width = '0%';
        }
        if (data.type === PMMessageType.OK) {
            NotificationHandler.showToast('info', data.content);
        } else if (data.type === PMMessageType.ERROR) {
            NotificationHandler.terminalLog('error', `Error occured: ${data.content}`, data.content);
        } else if (data.type === PMMessageType.WARNING) {
            NotificationHandler.terminalLog('warning', `Warning: ${data.content}`, data.content);
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
    async importDataflow(dataflow) {
        const { status, data } = await this.socket.emitWithAck('dataflow_action_request', 'import', dataflow);

        if (status === HTTPCodes.OK) {
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
        } else if (status === HTTPCodes.ServiceUnavailable) {
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
