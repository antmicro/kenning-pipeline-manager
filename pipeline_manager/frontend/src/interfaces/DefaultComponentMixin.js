/*
 * Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { defineAsyncComponent } from 'vue';

const DefaultComponentMixin = {
    setDefaultComponent() {
        delete this.defaultComponent;
        this.setComponent(
            defineAsyncComponent(() => this.lazyComponent()),
        );
    },
};

export default DefaultComponentMixin;
