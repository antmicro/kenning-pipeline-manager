/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable import/prefer-default-export */
export const backendApiUrl = (window.location.protocol === 'file:')
    ? null
    : `${window.location.protocol}//${window.location.host}`;

export const HTTPCodes = {
    OK: 200,
    BadRequest: 400,
    ServiceUnavailable: 503,
};
