/*
 * Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ButtonInterface as BaklavaButtonInterface } from '@baklavajs/renderer-vue';
import { withCustomNodeFunctions } from '../custom/CustomNodeInterface.js';
import DefaultComponentMixin from './DefaultComponentMixin.js';

export default class ButtonInterface extends withCustomNodeFunctions(BaklavaButtonInterface) {
    // eslint-disable-next-line class-methods-use-this
    lazyComponent = () => import(/* webpackMode: "eager" */ './ButtonInterface.vue');

    componentName = 'ButtonInterface';

    constructor(name, callback, value, type) {
        super(name, callback);
        this.value = value;
        this.type = type;
        this.defaultComponent = true;
    }
}

Object.assign(ButtonInterface.prototype, DefaultComponentMixin);
