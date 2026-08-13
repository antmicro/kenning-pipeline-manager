/*
 * Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import DefaultComponentMixin from '../../interfaces/DefaultComponentMixin.js';
import NestedForm from './NestedForm.vue';

export default class NestedFormInterface {
    componentName = 'NestedForm';

    constructor(name, label, template, config) {
        this.name = name;
        this.label = label;
        this.defaultComponent = true;
        this.component = NestedForm;
        this.template = template;
        this.config = config;
    }
}

Object.assign(NestedFormInterface.prototype, DefaultComponentMixin);
