/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Custom pipeline editor - Implements logic for adding, removing, editing nodes and
 * conections between them.
 * Inherits from baklavajs-core/src/editor.ts
 */

/*
 * Custom pipeline editor - Implements logic for adding, removing, editing nodes and
 * conections between them.
 * Inherits from baklavajs-core/src/editor.ts
 */

import { Editor } from 'baklavajs';

export default class PipelineManagerEditor extends Editor {
    readonly = false;

    allowLoopbacks = false;
}
