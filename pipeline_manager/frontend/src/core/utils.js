/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import Vue from 'vue';

/* eslint-disable import/prefer-default-export */
export const backendApiUrl = (Vue.config.devtools)
    ? `${window.location.protocol}//${window.location.hostname}:5000`
    : `${window.location.protocol}//${window.location.host}`;
