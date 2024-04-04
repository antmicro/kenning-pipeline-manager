/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    JSONRPCServerAndClient,
    JSONRPCServer,
    JSONRPCClient,
    JSONRPCRequest,
    JSONRPCResponse,
    JSONRPCServerMiddleware,
    JSONRPCServerMiddlewareNext,
    createJSONRPCErrorResponse,
} from 'json-rpc-2.0';
import Ajv2019 from 'ajv/dist/2019.js';
import { io, Socket } from 'socket.io-client';
import NotificationHandler from '../notifications';
import { backendApiUrl } from '../utils';
import commonTypesSchema from '../../../../resources/api_specification/common_types.json' assert { type: 'json' };
import specificationSchema from '../../../../resources/api_specification/specification.json' assert { type: 'json' };
import * as remoteProcedures from './remoteProcedures';

const customMethodRegex = /^custom_.*$/;
const customMethodReplace = 'dataflow_run';
class CustomJSONRPCServerAndClient extends JSONRPCServerAndClient {
    customMethodRegex: RegExp | null = null;

    customMethodReplace: string | null = null;
}

type SpecType = {
    params: object,
    returns: object | null, // null when method is a notification
};
const ajv = new Ajv2019({
    schemas: [commonTypesSchema],
    allowUnionTypes: true,
    strict: true,
});
const frontendEndpoints: { [key: string]: SpecType } = specificationSchema.frontend_endpoints;
const backendEndpoints: { [key: string]: SpecType } = specificationSchema.backend_endpoints;
const externalEndpoints: { [key: string]: SpecType } = specificationSchema.external_endpoints;

// This should become part of the testing suite at some point
let invalidDefinition;
try {
    [frontendEndpoints, backendEndpoints, externalEndpoints].forEach((endpoints) => {
        Object.entries(endpoints).forEach(([definitionName, definition]) => {
            invalidDefinition = definitionName;
            ajv.compile(definition.params);
            ajv.compile(definition.returns ?? {});
        });
    });
} catch (exception) {
    throw new Error(`Procedures specification schema '${invalidDefinition}' is incorrect: ${exception}`);
}

/**
 * Middleware that validates received requests.
 */
const validateServerRequestResponse = async (
    next: JSONRPCServerMiddlewareNext<void>,
    request: JSONRPCRequest,
    serverParams: void,
): Promise<JSONRPCResponse | null> => {
    // request validation
    if (!(request.method in frontendEndpoints)) {
        if (request.id !== undefined) return createJSONRPCErrorResponse(request.id, 1, 'Requested method does not exist');
        throw new Error('Requested method does not exist');
    }
    const schema = frontendEndpoints[request.method];
    const valid = ajv.validate(schema.params, request.params ?? {});
    if (!valid) {
        if (request.id !== undefined) return createJSONRPCErrorResponse(request.id, 1, 'Request does not match specification');
        throw new Error('Request does not match specification');
    }
    const response = await next(request, serverParams);
    if (request.id === undefined) return null;

    // response validation
    if (response?.result !== undefined && schema.returns !== null) {
        const validResponse = ajv.validate(schema.returns, response.result);
        if (!validResponse) {
            if (request.id !== undefined) {
                return createJSONRPCErrorResponse(
                    request.id, 1, 'Response does not match specification',
                );
            }
            throw new Error('Response does not match specification');
        }
    }
    return response;
};

let jsonRPCID = 1;
// eslint-disable-next-line no-plusplus
const createID = () => jsonRPCID++;
const commonHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
};
const requestSchema = new Map<number | string, SpecType>();

const MAX_MESSAGE_LENGTH = 256 * 1024;
let socket: Socket;
let jsonRPCServer: CustomJSONRPCServerAndClient;
/**
 * Function that creates JSON-RPC client-server and defines how messages are send and received.
 */
function createServer() {
    // Initialize SocketIO
    if (!backendApiUrl) return;
    socket = io(backendApiUrl, {
        extraHeaders: commonHeaders,
    });
    // Create JSON-RPC server
    jsonRPCServer = new JSONRPCServerAndClient(
        new JSONRPCServer(),
        new JSONRPCClient(async (request: JSONRPCRequest) => {
            const method = (customMethodRegex.test(request.method)) ?
                customMethodReplace : request.method;
            // request validation
            if (!(method in externalEndpoints) && !(method in backendEndpoints)) {
                throw new Error('Requested method not known');
            }
            if (socket.disconnected) {
                return Promise.reject(
                    new Error('WebSocket is disconnected. Make sure the communication server is available.'),
                );
            }

            const endpoints = (method in externalEndpoints) ?
                externalEndpoints : backendEndpoints;
            const schema = endpoints[method];
            const valid = ajv.validate(schema.params, request.params ?? {});
            if (!valid) return Promise.reject(new Error('Request does not match specification'));
            if (request.id) {
                requestSchema.set(request.id, schema);
            }

            // sending request
            const endpoint = (endpoints === backendEndpoints) ? 'backend-api' : 'external-api';
            const stringify = JSON.stringify(request);
            try {
                // Emit request in chunks
                if (stringify.length > MAX_MESSAGE_LENGTH) {
                    const messageID = request.id ?? crypto.randomUUID();
                    for (let i = 0; i < stringify.length; i += MAX_MESSAGE_LENGTH) {
                        socket.emit(endpoint, {
                            id: messageID,
                            chunk: stringify.substring(
                                i, Math.min(i + MAX_MESSAGE_LENGTH, stringify.length),
                            ),
                            end: i + MAX_MESSAGE_LENGTH >= stringify.length,
                        });
                    }
                // Emit whole request
                } else {
                    socket.emit(endpoint, request);
                }
            } catch (exception) {
                return Promise.reject(exception);
            }
            return Promise.resolve();
        }, createID),
    ) as CustomJSONRPCServerAndClient;
    // Add middlewares
    jsonRPCServer.server.applyMiddleware(
        validateServerRequestResponse as JSONRPCServerMiddleware<void>);
    // Register JSON-RPC methods
    Object.entries(remoteProcedures).forEach(([name, func]) => {
        if (typeof (func) === 'function' && name in frontendEndpoints) jsonRPCServer.addMethod(name, func);
        else if (typeof (func) === 'function') {
            NotificationHandler.showToast('warning', `Function ${name} was not registered as RPC method`);
        }
    });

    // Define SocketIO events
    socket.on('connect', () => NotificationHandler.terminalLog('info', 'Initialized connection with communication server', null));
    socket.on('disconnect', () => {
        NotificationHandler.terminalLog('warning', 'Connection with communication server disrupted', null);
        jsonRPCServer.rejectAllPendingRequests('WebSocket disconnected');
    });

    socket.on('api', async (data: JSONRPCRequest) => {
        const response = await jsonRPCServer.server.receive(data);
        if (response) {
            try {
                const ack = await socket.emitWithAck('external-api', response);
                if (ack !== undefined && !ack) {
                    NotificationHandler.terminalLog('error', 'Response to external app was not send', null);
                }
            } catch (error) {
                NotificationHandler.terminalLog('error', `Response to ${data.method} request cannot be send`, error);
            }
        }
    });
    socket.on('api-response', (response: JSONRPCResponse) => {
        // response validation
        if (response.result && response.id && requestSchema.get(response.id)?.returns) {
            const validResponse = ajv.validate(
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                requestSchema.get(response.id)!.returns!,
                response.result,
            );
            if (!validResponse) {
                jsonRPCServer.client.receive(
                    createJSONRPCErrorResponse(
                        response.id, 1, 'Response does not match specification',
                    ),
                );
                return;
            }
        }
        jsonRPCServer.client.receive(response);
    });
    jsonRPCServer.customMethodRegex = customMethodRegex;
    jsonRPCServer.customMethodReplace = customMethodReplace;
}

const obj = {
    get jsonRPC() {
        if (!jsonRPCServer) createServer();
        return jsonRPCServer;
    },
};
export default obj.jsonRPC;
