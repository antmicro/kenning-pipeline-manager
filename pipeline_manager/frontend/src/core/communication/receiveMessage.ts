/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/*
 * This module containes all possible JSON-RPC requests that frontend can
 * receive and process.
 *
 * Each exported function is automatically registered as JSON-RPC method
 * when JSON-RPC server is created in fetchRequest.
 * Function name have to match with specification (resources/api_specification).
 */

/* eslint-disable import/prefer-default-export */
/* eslint-disable camelcase */

export async function get_status(): Promise<{ status: string; }> {
    return {
        status: 'healthy',
    };
}
