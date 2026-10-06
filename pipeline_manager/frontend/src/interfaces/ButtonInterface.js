/*
 * Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ButtonInterface as BaklavaButtonInterface } from '@baklavajs/renderer-vue';
import { withCustomNodeFunctions } from '../custom/CustomNodeInterface.js';

export default class ButtonInterface extends withCustomNodeFunctions(BaklavaButtonInterface) {
    componentName = 'ButtonInterface';

    constructor(name, callback, value, type) {
        super(name, callback);
        this.value = value;
        this.type = type;
    }
}
