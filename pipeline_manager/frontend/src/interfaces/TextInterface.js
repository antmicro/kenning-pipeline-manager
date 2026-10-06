/*
 * Copyright (c) 2022-2025 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { TextInterface as BaklavaTextInterface } from '@baklavajs/renderer-vue';
import { withCustomNodeFunctions } from '../custom/CustomNodeInterface.js';

export default class TextInterface extends withCustomNodeFunctions(BaklavaTextInterface) {
    componentName = 'TextInterface';
}
