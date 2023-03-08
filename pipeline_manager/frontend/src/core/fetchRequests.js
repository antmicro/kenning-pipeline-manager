/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable import/prefer-default-export */

import { backendApiUrl } from './utils';

export async function fetchGET(endpoint) {
    const requestOptions = {
        method: 'GET',
        headers: {
            'Access-Control-Allow-Origin': backendApiUrl,
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        },
    };
    return fetch(`${backendApiUrl}/${endpoint}`, requestOptions);
}

export async function fetchPOST(endpoint, data) {
    const requestOptions = {
        method: 'POST',
        body: data,
        headers: {
            'Access-Control-Allow-Origin': backendApiUrl,
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept',
        },
    };
    return fetch(`${backendApiUrl}/${endpoint}`, requestOptions);
}
