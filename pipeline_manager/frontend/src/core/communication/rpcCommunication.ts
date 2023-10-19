/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import {
    JSONRPCServerAndClient,
    JSONRPCServer,
    JSONRPCClient,
    JSONRPCRequest,
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
import * as receiveMessage from './receiveMessage';

type SpecType = {
    params: object,
    returns: object,
};
const ajv = new Ajv2019({
    schemas: [commonTypesSchema],
    allowUnionTypes: true,
    strict: true,
});
const frontendEndpoints: { [key: string]: SpecType } = specificationSchema.frontend_endpoints;
const backendEndpoints: { [key: string]: SpecType } = specificationSchema.backend_endpoints;
const externalEndpoints: { [key: string]: SpecType } = specificationSchema.external_endpoints;

/**
 * Middleware that validates received requests.
 */
const validateServerRequestResponse = (
    next: JSONRPCServerMiddlewareNext<void>,
    request: JSONRPCRequest,
    serverParams: void,
) => {
    // request validation
    if (!(request.method in frontendEndpoints)) {
        if (request.id) return createJSONRPCErrorResponse(request.id, 1, 'Requested method does not exist');
        throw new Error('Requested method does not exist');
    }
    const schema = frontendEndpoints[request.method];
    const valid = ajv.validate(schema.params, request.params ?? {});
    if (!valid) {
        if (request.id) return createJSONRPCErrorResponse(request.id, 1, 'Request does not match specification');
        throw new Error('Request does not match specification');
    }
    return next(request, serverParams).then((response) => {
        // response validation
        if (response?.result) {
            const validResponse = ajv.validate(schema.returns, response.result);
            if (!validResponse) {
                if (request.id) {
                    return createJSONRPCErrorResponse(
                        request.id, 1, 'Response does not match specification',
                    );
                }
                throw new Error('Response does not match specification');
            }
        }
        return response;
    });
};

let jsonRPCID = 1;
// eslint-disable-next-line no-plusplus
const createID = () => jsonRPCID++;
const commonHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
};

let socket: Socket;
let jsonRPCServer: JSONRPCServerAndClient;
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
            // request validation
            if (!(request.method in externalEndpoints) && !(request.method in backendEndpoints)) {
                throw new Error('Requested method not known');
            }
            const endpoints = (request.method in externalEndpoints) ?
                externalEndpoints : backendEndpoints;
            const schema = endpoints[request.method];
            const valid = ajv.validate(schema.params, request.params ?? {});
            if (!valid) return Promise.reject(new Error('Request does not match specification'));

            // sending request
            const endpoint = (endpoints === backendEndpoints) ? 'backend-api' : 'api';
            const jsonRPCResponse = await socket.emitWithAck(endpoint, request);

            // response validation
            if (jsonRPCResponse.result) {
                const validResponse = ajv.validate(schema.returns, jsonRPCResponse.result);
                if (!validResponse) return Promise.reject(new Error('Response does not match specification'));
            }
            jsonRPCServer.client.receive(jsonRPCResponse);
            return Promise.resolve();
        }, createID),
    );
    // Add middlewares
    jsonRPCServer.server.applyMiddleware(
        validateServerRequestResponse as JSONRPCServerMiddleware<void>);
    // Register JSON-RPC methods
    Object.entries(receiveMessage).forEach(([name, func]) => {
        if (typeof (func) === 'function') jsonRPCServer.addMethod(name, func);
    });

    // Define SocketIO events
    socket.on('connect', () => NotificationHandler.terminalLog('info', 'Initialized connection with backend', null));
    socket.on('disconnect', () => {
        NotificationHandler.terminalLog('warning', 'Connection with backend disrupted', null);
        jsonRPCServer.rejectAllPendingRequests('WebSocket disconnected');
    });

    socket.on('api', async (data: JSONRPCRequest, callback) => {
        const response = await jsonRPCServer.server.receive(data);
        callback(JSON.stringify(response));
    });
}

const obj = {
    get jsonPRC() {
        if (!jsonRPCServer) createServer();
        return jsonRPCServer;
    },
};
export default obj.jsonPRC;
