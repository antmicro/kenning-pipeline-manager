/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Implements additional functions for CustomNode
 */

/**
 * The function decides whether a name for the option should be displayed.
 *
 * @param optionType Name of the option component
 * @returns True if the name should be displayed, false otherwise.
 */
export default function getOptionName(optionType) {
    switch (optionType) {
        case 'InputInterface':
        case 'SelectInterface':
        case 'ListInterface':
        case 'TextInterface':
        case 'HexInterface':
            return true;
        case 'NumberInterface':
        case 'IntegerInterface':
        case 'CheckboxInterface':
        case 'SliderInterface':
        case 'NodeInterface':
        default:
            return false;
    }
}
