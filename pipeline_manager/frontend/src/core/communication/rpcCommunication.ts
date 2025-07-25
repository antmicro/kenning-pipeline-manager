/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line max-classes-per-file
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
import NotificationHandler from '../notifications';
import { PMMessageType } from '../utils';
import commonTypesSchema from '../../../../resources/api_specification/common_types.json' with { type: 'json' };
import specificationSchema from '../../../../resources/api_specification/specification.json' with { type: 'json' };

// eslint-disable-next-line import/no-cycle
import * as remoteProcedures from './remoteProcedures';
import { ClientParams, Endpoints, SpecType } from './utils';

class CustomJSONRPCServerAndClient extends JSONRPCServerAndClient<void, ClientParams> {
    customMethodRegex: RegExp | null = null;

    customMethodReplace: string | null = null;
}

const customMethodRegex = /^custom_.*$/;
const customMethodReplace = 'dataflow_run';

const ajv = new Ajv2019({
    schemas: [commonTypesSchema],
    allowUnionTypes: true,
    strict: true,
});

export const frontendEndpoints: Endpoints = specificationSchema.frontend_endpoints;
export const backendEndpoints: Endpoints = specificationSchema.backend_endpoints;
export const externalEndpoints: Endpoints = specificationSchema.external_endpoints;

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
const requestSchema = new Map<number | string, SpecType>();

let jsonRPCServer: CustomJSONRPCServerAndClient;

const validateClientResponse = (response: JSONRPCResponse) => {
    if (response.result && response.id && requestSchema.get(response.id)?.returns) {
        const validResponse = ajv.validate(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            requestSchema.get(response.id)!.returns!,
            response.result,
        );
        if (!validResponse) {
            return createJSONRPCErrorResponse(
                response.id, PMMessageType.ERROR, 'Response does not match specification',
            );
        }
    }
    return response;
};

class CustomJSONRPCClient<C> extends JSONRPCClient<C> {
    receive(responses: JSONRPCResponse | JSONRPCResponse[]): void {
        // eslint-disable-next-line no-param-reassign
        responses = Array.isArray(responses) ? responses : [responses];
        super.receive(responses.map(validateClientResponse));
    }
}

/**
 * Function that creates JSON-RPC client-server and defines how messages are send and received.
 */
function createServer() {
    // Create JSON-RPC server
    jsonRPCServer = new CustomJSONRPCServerAndClient(
        new JSONRPCServer(),
        new CustomJSONRPCClient(async (request: JSONRPCRequest, { externalApp }) => {
            if (!externalApp) {
                throw new Error('Missing backend.');
            }
            const method = (customMethodRegex.test(request.method)) ?
                customMethodReplace : request.method;
            // request validation
            if (!(method in externalEndpoints) && !(method in backendEndpoints)) {
                throw new Error('Requested method not known');
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
            try {
                externalApp.request(JSON.parse(JSON.stringify(request)), endpoint);
            } catch (exception) {
                return Promise.reject(exception);
            }
            return Promise.resolve();
        }, createID),
    );
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
