/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable import/prefer-default-export */
export const backendApiUrl =
    window.location.protocol === 'file:' ||
    (process.env.VUE_APP_STATIC !== undefined && process.env.VUE_APP_STATIC === 'true')
        ? null
        : `${window.location.protocol}//${window.location.host}`;

export const HTTPCodes = {
    OK: 200,
    BadRequest: 400,
    ServiceUnavailable: 503,
};

export const MessageTypes = {
    OK: 0,
    ERROR: 1,
    VALIDATE: 2,
    SPECIFICATION: 3,
    RUN: 4,
    IMPORT: 5,
    EXPORT: 6,
}
