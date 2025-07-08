/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { JSONRPCErrorCode } from 'json-rpc-2.0';
import { charset } from 'mime-types';
import { nextTick } from 'vue';
import { backendApiUrl, PMMessageType, JSONRPCCustomErrorCode } from '../utils';

// eslint-disable-next-line import/no-cycle
import jsonRPC from './rpcCommunication';
import runInfo from './runInformation';
import NotificationHandler from '../notifications';
import EditorManager, { loadJsonFromRemoteLocation } from '../EditorManager';

// Default external application capabilities
const defaultAppCapabilities = {};

/**
 * Creates notifications based on response received from external application.
 */
function handleExternalAppResponse(response) {
    // Status is HTTPCodes.OK so a message from the application is received.
    if (response.type === PMMessageType.OK) {
        NotificationHandler.terminalLog('info', response.content);
    } else if (response.type === PMMessageType.ERROR) {
        NotificationHandler.terminalLog('error', `Error occurred: ${response.content}`, response.content);
    } else if (response.type === PMMessageType.WARNING) {
        NotificationHandler.terminalLog('warning', `Warning: ${response.content}`, response.content);
    }
}

/**
 * Creates notifications based on specification.
 * Returns `true` if error appeared.
 */
function handleSpecificationResult({ errors, warnings }, errorTitle, warningTitle) {
    if (Array.isArray(warnings) && warnings.length) {
        NotificationHandler.terminalLog('warning', warningTitle, warnings);
    }
    if (Array.isArray(errors) && errors.length) {
        NotificationHandler.terminalLog('error', errorTitle, errors);
        return true;
    }
    return false;
}

const startTimeoutStatusInterval = 1500;

class ExternalApplicationManager {
    externalApplicationConnected = false;

    backendAvailable = backendApiUrl !== null;

    editorManager = EditorManager.getEditorManagerInstance();

    idStatusInterval = null;

    timeoutStatusInterval = startTimeoutStatusInterval;

    appCapabilities = {};

    /**
     * Function that fetches state of the connection and updates.
     * `this.externalApplicationConnected` property.
     */
    async updateConnectionStatus() {
        try {
            const response = await jsonRPC.request('status_get');

            // If the application was connected and the connection was lost, a warning is displayed.
            if (!response.status.connected && this.externalApplicationConnected) {
                NotificationHandler.terminalLog('warning', 'External application was disconnected');
            }

            // If external-app disconnects while running, the progress bar needs to be reset.
            if (this.externalApplicationConnected !== response.status.connected) {
                const progressBar = document.querySelector('.progress-bar');
                progressBar.style.width = '0%';
                runInfo.forEach((_v, k) => { runInfo.get(k).inProgress = false; });
            }

            this.externalApplicationConnected = response.status.connected;
        } catch (error) {
            this.externalApplicationConnected = false;
        }
    }

    /**
     * Event handler that asks the backend to open a TCP socket that can be connected to.
     * If the external application did not connect the user is alerted with a feedback message.
     * This function updates `this.externalApplicationConnected` property
     *
     * @returns {null | [string, string]} Null if the connection was successful, otherwise a tuple
     * containing the toast type and the message.
     */
    async openTCP() {
        try {
            await jsonRPC.request('external_app_connect');
            this.externalApplicationConnected = true;
            return null;
        } catch (error) {
            this.externalApplicationConnected = false;
            const errorCode = error.code ?? JSONRPCCustomErrorCode.EXCEPTION_RAISED;
            const messageType = (errorCode !== JSONRPCCustomErrorCode.NEWER_SESSION_AVAILABLE) ? 'warning' : 'info';
            return [messageType, error.message];
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

                await this.updateSpecification(specification);

                NotificationHandler.terminalLog('info', 'Specification loaded successfully');
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

    async conditionalLoadingScreen(load, callback) {
        const { setLoad } = this.editorManager.baklavaView.editor.events;

        if (load) {
            setLoad.emit(true);
            await nextTick();
        }
        const result = await callback();
        if (load) {
            setLoad.emit(false);
            await nextTick();
        }
        return result;
    }

    async updateSpecification(specification) {
        if (handleSpecificationResult(
            EditorManager.validateSpecification(specification),
            'Specification is invalid',
            'Warnings when validating specification',
        )) return true;
        return handleSpecificationResult(
            await this.editorManager.updateEditorSpecification(specification),
            'Errors when loading specification',
            'Warnings when loading specification',
        );
    }

    async updateDataflow(dataflow) {
        if (typeof dataflow === 'string' || dataflow instanceof String) {
            const [success, dataflowOrError] = await loadJsonFromRemoteLocation(dataflow);
            if (!success) {
                NotificationHandler.terminalLog('error', 'Dataflow is invalid', dataflowOrError);
                return;
            }

            // eslint-disable-next-line no-param-reassign
            dataflow = dataflowOrError;
        }
        const { errors, warnings } = await this.editorManager.loadDataflow(dataflow);
        if (Array.isArray(errors) && errors.length) {
            NotificationHandler.terminalLog('error', 'Dataflow is invalid', errors);
        } else if (Array.isArray(warnings) && warnings.length) {
            NotificationHandler.terminalLog('warning', 'Dataflow loaded with warning', warnings);
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
            NotificationHandler.terminalLog('warning', 'Application capabilities cannot be retrieved, using defaults', error.message);
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
            // The connection was closed.
            data = error.message;
            NotificationHandler.terminalLog('error', data);
            return false;
        }

        // Status is HTTPCodes.OK so a message from the application is received.
        if (data.type === PMMessageType.OK) {
            return data;
        }

        if (data.type === PMMessageType.ERROR) {
            NotificationHandler.terminalLog('error', `Error occurred: ${data.content}`, data.content);
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
            NotificationHandler.terminalLog('error', 'Cannot create a request', data);
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

        const reader = new FileReader();
        const encoding = charset(file.type);
        const readerPromise = new Promise((resolve) => {
            reader.onloadend = () => {
                resolve(
                    (encoding) ? reader.result : reader.result.replace(/data:.*;base64,/, ''),
                );
            };
        });
        // Read file as text if possible, otherwise return base64 string
        if (encoding) {
            reader.readAsText(file, encoding);
        } else {
            reader.readAsDataURL(file);
        }
        const dataflow = await readerPromise;
        if (!dataflow) {
            NotificationHandler.showToast('error', 'File cannot be loaded');
            return;
        }

        try {
            const data = await jsonRPC.request('dataflow_import', { external_application_dataflow: dataflow, mime: file.type, base64: !encoding });
            if (data.type === PMMessageType.OK) {
                const { errors, warnings } = await this.editorManager.loadDataflow(data.content);
                if (Array.isArray(errors) && errors.length) {
                    NotificationHandler.terminalLog('error', 'Dataflow is invalid', errors);
                } else if (Array.isArray(warnings) && warnings.length) {
                    NotificationHandler.terminalLog('warning', 'Dataflow imported with warning', warnings);
                } else {
                    NotificationHandler.showToast('info', 'Imported dataflow');
                }
            } else if (data.type === PMMessageType.ERROR) {
                const message = data.content;
                NotificationHandler.terminalLog('error', `Error occurred: ${data.content}`, message);
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
                    'warning', 'Notifying about change failed', `${error.message} (method: ${method})`,
                );
            }
        }
    }

    /**
     * Send information to external application about input received by writable terminal.
     *
     * @param terminal Name Name of the terminal
     * @param message Input provided for the terminal
     */
    async requestTerminalRead(terminalName, message) {
        if (!(
            this.backendAvailable && this.externalApplicationConnected
        )) {
            return;
        }
        try {
            await jsonRPC.request('terminal_read', { name: terminalName, message });
        } catch (error) {
            NotificationHandler.terminalLog('warning', 'Sending terminal input failed', error.message);
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
                await this.initializeConnection(false);
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
    async initializeConnection(checkConnection = true) {
        if (checkConnection) {
            await this.updateConnectionStatus();
        }

        if (!this.externalApplicationConnected) {
            do {
                NotificationHandler.terminalLog(
                    'info',
                    `Trying to establish connection with external application`,
                );

                /* eslint-disable-next-line no-await-in-loop */
                const message = await this.openTCP();

                if (message !== null) {
                    /* eslint-disable-next-line no-await-in-loop,no-promise-executor-return */
                    await new Promise((r) => setTimeout(r, this.timeoutStatusInterval));
                } else {
                    NotificationHandler.terminalLog(
                        'info',
                        `External application connected successfully`,
                    );
                }
            } while (!this.externalApplicationConnected);
            this.timeoutStatusInterval = startTimeoutStatusInterval;
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
                    NotificationHandler.terminalLog('error', error.message, error.data);
                }
            }
        }
    }
}

let externalApplicationManager;

export default function getExternalApplicationManager() {
    if (!externalApplicationManager) externalApplicationManager = new ExternalApplicationManager();
    return externalApplicationManager;
}
