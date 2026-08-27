/*
 * Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import DefaultComponentMixin from '../../interfaces/DefaultComponentMixin.js';
import DynamicForm from './DynamicForm.vue';

export default class DynamicFormInterface {
    componentName = 'DynamicForm';

    constructor(name, template, config, value, min = 1, max = Number.MAX_SAFE_INTEGER) {
        this.name = name;
        this.dynamic = true;
        this.defaultComponent = true;
        this.component = DynamicForm;
        this.template = template;
        this.config = config;
        this.value = value;
        this.min = min;
        this.max = max;
    }
}

Object.assign(DynamicFormInterface.prototype, DefaultComponentMixin);
