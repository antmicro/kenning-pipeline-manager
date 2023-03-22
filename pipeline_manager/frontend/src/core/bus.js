/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import Vue from 'vue';

/* Bus used to emit messages to the user.
   Can be accessed globally. */
/* eslint-disable import/prefer-default-export */
export const alertBus = new Vue();
