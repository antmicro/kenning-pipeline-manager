/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { markRaw } from 'vue';
import { NodeInterface } from 'baklavajs';
import SliderInterfaceComponent from './SliderInterface.vue';

export default class SliderInterface extends NodeInterface {
    constructor(name, value, min, max) {
        super(name, value);
        this.min = min;
        this.max = max;

        this.setComponent(markRaw(SliderInterfaceComponent));
    }
}
