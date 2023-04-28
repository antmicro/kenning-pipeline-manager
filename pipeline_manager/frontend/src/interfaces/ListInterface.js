/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { markRaw } from 'vue';
import { NodeInterface } from 'baklavajs';
import ListInterfaceComponent from './ListInterface.vue';

export default class InputInterface extends NodeInterface {
    constructor(name, value, dtype) {
        super(name, value);
        this.dtype = dtype;
        this.setComponent(markRaw(ListInterfaceComponent));
    }
}
