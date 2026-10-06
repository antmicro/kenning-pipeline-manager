/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { CustomNodeInterface } from '../custom/CustomNodeInterface.js';
import DefaultComponentMixin from './DefaultComponentMixin.js';

export default class ListInterface extends CustomNodeInterface {
    // eslint-disable-next-line class-methods-use-this
    lazyComponent = () => import(/* webpackMode: "eager" */ './ListInterface.vue');

    componentName = 'ListInterface';

    constructor(name, value, dtype, readonly = false) {
        super(name, value);
        this.dtype = dtype;
        this.readonly = readonly;
        this.defaultComponent = true;
        this.setPort(false);
    }
}

Object.assign(ListInterface.prototype, DefaultComponentMixin);
