/*
 * Copyright (c) 2022-2024 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable import/prefer-default-export */
const getBackendApiUrl = () => {
    if (
        window.location.protocol === 'file:' ||
        (process.env.VUE_APP_STATIC !== undefined && process.env.VUE_APP_STATIC === 'true')
    ) return null;

    if (
        process.env.VUE_APP_COMMUNICATION_SERVER_HOST !== undefined &&
        process.env.VUE_APP_COMMUNICATION_SERVER_PORT !== undefined
    ) return `http://${process.env.VUE_APP_COMMUNICATION_SERVER_HOST}:${process.env.VUE_APP_COMMUNICATION_SERVER_PORT}`;

    return `${window.location.protocol}//${window.location.host}`;
};

export const backendApiUrl = getBackendApiUrl();

export const HTTPCodes = {
    OK: 200,
    BadRequest: 400,
    ServiceUnavailable: 503,
};

export const PMMessageType = {
    OK: 0,
    ERROR: 1,
    PROGRESS: 2,
    WARNING: 3,
};

export const JSONRPCCustomErrorCode = {
    EXCEPTION_RAISED: -1,
    EXTERNAL_APPLICATION_NOT_CONNECTED: -2,
    NEWER_SESSION_AVAILABLE: -3,
};
