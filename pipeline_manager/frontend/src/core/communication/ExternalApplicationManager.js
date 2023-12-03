/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { JSONRPCErrorCode } from 'json-rpc-2.0';
import { backendApiUrl, PMMessageType, JSONRPCCustomErrorCode } from '../utils';
import jsonRPC from './rpcCommunication';
import runInfo from './runInformation';
import NotificationHandler from '../notifications';
import EditorManager from '../EditorManager';

// Default external application capabilities
const defaultAppCapabilities = {};

/**
 * Creates notifications based on response received from external application
 */
function handleExternalAppResponse(response) {
    // Status is HTTPCodes.OK so a message from the application is received.
    if (response.type === PMMessageType.OK) {
        NotificationHandler.showToast('info', response.content);
    } else if (response.type === PMMessageType.ERROR) {
        NotificationHandler.terminalLog('error', `Error occured: ${response.content}`, response.content);
    } else if (response.type === PMMessageType.WARNING) {
        NotificationHandler.terminalLog('warning', `Warning: ${response.content}`, response.content);
    }
}

class ExternalApplicationManager {
    externalApplicationConnected = false;

    backendAvailable = backendApiUrl !== null;

    editorManager = EditorManager.getEditorManagerInstance();

    idStatusInterval = null;

    timeoutStatusInterval = 1500;

    appCapabilities = {};

    /**
     * Function that fetches state of the connection and updates
     * `this.externalApplicationConnected` property.
     */
    async updateConnectionStatus() {
        try {
            const response = await jsonRPC.request('status_get');

            // If external-app disconnects while running, the progress bar needs to be reset.
            if (this.externalApplicationConnected !== response.status.connected) {
                const progressBar = document.querySelector('.progress-bar');
                progressBar.style.width = '0%';
                runInfo.forEach((_v, k) => { runInfo.get(k).inProgress = false; });
            }

            this.externalApplicationConnected = response.status.connected;
        } catch (error) {
            NotificationHandler.terminalLog('error', 'Checking status', error.message);
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
            NotificationHandler.terminalLog('warning', 'Connecting with external app', error.message);
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
            const data = await jsonRPC.request('specification_get');

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
    * Provides capabilities of the third-party app connected via server
    * to Pipeline Manager's frontend.
    */
    async requestAppCapabilities() {
        try {
            const appCapabilities = await jsonRPC.request('app_capabilities_get');
            this.appCapabilities = { ...defaultAppCapabilities, ...appCapabilities };
        } catch (error) {
            this.appCapabilities = { ...defaultAppCapabilities };
            NotificationHandler.terminalLog('warning', 'Application capabilities cannot be retreived, using defaults', error.message);
        }
    }

    /**
    * Handles dataflow export.
    */
    async requestDataflowExport() {
        const dataflow = this.editorManager.saveDataflow();
        if (!dataflow) return false;

        let data;
        try {
            data = await jsonRPC.request('dataflow_export', { dataflow });
        } catch (error) {
            // The connection was closed
            data = error.message;
            NotificationHandler.terminalLog('error', data);
            return false;
        }

        // Status is HTTPCodes.OK so a message from the application is received.
        if (data.type === PMMessageType.OK) {
            return data;
        }

        if (data.type === PMMessageType.ERROR) {
            NotificationHandler.terminalLog('error', `Error occured: ${data.content}`, data.content);
        } else if (data.type === PMMessageType.WARNING) {
            NotificationHandler.terminalLog('warning', `Warning: ${data.content}`, data.content);
        }
        return false;
    }

    /**
     * Event handler that loads a current dataflow from the editor and sends a request
     * to the backend based on the action argument.
     * The user is alerted with a feedback message.
     *
     * @param procedureName Name of the requested procedure.
     */
    async requestDataflowAction(procedureName) {
        const dataflow = this.editorManager.saveDataflow();
        const runProcedureInfo = runInfo.get(procedureName);
        if (!dataflow) return;
        const validatedProcedureName = (jsonRPC.customMethodRegex.test(procedureName)) ?
            jsonRPC.customMethodReplace : procedureName;

        if (validatedProcedureName === 'dataflow_run') {
            if (runProcedureInfo.inProgress) {
                NotificationHandler.showToast('error', 'Previous run has not finished, cannot process this request');
                return;
            }
            NotificationHandler.showToast('info', 'Running dataflow');
        }
        runProcedureInfo.inProgress = true;

        let data;
        try {
            if (validatedProcedureName.startsWith('dataflow_')) {
                data = await jsonRPC.request(procedureName, { dataflow });
            } else {
                data = await jsonRPC.request(validatedProcedureName);
            }
        } catch (error) {
            // The connection was closed
            data = error.message;
            NotificationHandler.terminalLog('error', data);
            runProcedureInfo.inProgress = false;
            return;
        }

        handleExternalAppResponse(data);
        runProcedureInfo.inProgress = false;
    }

    /**
     * Event handler that check if remote procedure is running and send stop request.
     * The user is alerted with a feedback message.
     *
     * @param procedureName Name of the requested procedure.
     */
    // eslint-disable-next-line class-methods-use-this
    async requestDataflowStop(procedureName) {
        if (!runInfo.get(procedureName).inProgress) {
            NotificationHandler.showToast('error', 'Nothing to stop, no ongoing jobs running');
            return;
        }

        try {
            const response = await jsonRPC.request('dataflow_stop', { method: procedureName });
            handleExternalAppResponse(response);
        } catch (error) {
            NotificationHandler.terminalLog('error', error.message);
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
            const data = await jsonRPC.request('dataflow_import', { external_application_dataflow: dataflow });
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
     * Send information to external application about changed values (like nodes, connections,
     * positions, properties).
     *
     * @param method Name of the JSON-RPC method.
     * @param changedProperties Params of the send request, should contain changed values.
     */
    async notifyAboutChange(method, changedProperties) {
        if (
            this.backendAvailable && this.externalApplicationConnected &&
            this.editorManager.notifyWhenChanged
        ) {
            try {
                await jsonRPC.request(method, changedProperties);
            } catch (error) {
                NotificationHandler.terminalLog(
                    'warning', 'Error when notifing about change', error.message,
                );
            }
        }
    }

    /**
     * Function that is used by setInterval() to periodically check the status
     * of the TCP connection. If the connection is not alive, then `initializeConnection`
     * is invoked.
     */
    async checkConnectionStatus() {
        while (this.interval) {
            /* eslint-disable-next-line no-await-in-loop */
            await this.updateConnectionStatus();
            if (!this.externalApplicationConnected) {
                runInfo.forEach((_v, k) => { runInfo.get(k).inProgress = false; });
                /* eslint-disable-next-line no-await-in-loop */
                await this.initializeConnection(false, true);
            }
            /* eslint-disable-next-line no-await-in-loop,no-promise-executor-return */
            await new Promise((r) => setTimeout(r, this.timeoutStatusInterval));
        }
    }

    /**
     * Starts status checking.
     */
    startStatusInterval() {
        if (this.idStatusInterval === null) {
            this.interval = true;
            this.idStatusInterval = this.checkConnectionStatus();
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
    async initializeConnection(checkConnection = true, startInterval = true) {
        if (checkConnection) {
            await this.updateConnectionStatus();
        }

        if (!this.externalApplicationConnected) {
            NotificationHandler.showToast('info', 'Waiting for the application to connect...');
            do {
                /* eslint-disable-next-line no-await-in-loop */
                await this.openTCP();
                if (!this.externalApplicationConnected) {
                    NotificationHandler.showToast('info', 'Application cannot connect, retrying...');
                    /* eslint-disable-next-line no-await-in-loop,no-promise-executor-return */
                    await new Promise((r) => setTimeout(r, 2 * this.timeoutStatusInterval));
                }
            } while (!this.externalApplicationConnected);
        }
        if (this.externalApplicationConnected) {
            await Promise.all([
                this.requestSpecification(),
                this.requestAppCapabilities(),
            ]);
        }
        if (this.externalApplicationConnected) {
            try {
                await jsonRPC.request('frontend_on_connect');
            } catch (error) {
                if (error.code !== JSONRPCErrorCode.MethodNotFound &&
                    error.code !== JSONRPCCustomErrorCode.EXTERNAL_APPLICATION_NOT_CONNECTED) {
                    NotificationHandler.terminalLog('warning', error.message, error.data);
                }
            }
        }

        if (startInterval) this.startStatusInterval();
    }
}

let externalApplicationManager;

export default function getExternalApplicationManager() {
    if (!externalApplicationManager) externalApplicationManager = new ExternalApplicationManager();
    return externalApplicationManager;
}
