/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { NodeInterface } from '@baklavajs/core';

export default class HexInterface extends NodeInterface {
    constructor(name, value, min, max) {
        super(name, value);
        this.min = min;
        this.max = max;
    }
}
