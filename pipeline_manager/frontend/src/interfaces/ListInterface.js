/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeInterface } from '@baklavajs/core';

export default class InputInterface extends NodeInterface {
    constructor(name, value, dtype) {
        super(name, value);
        this.dtype = dtype;
    }
}
