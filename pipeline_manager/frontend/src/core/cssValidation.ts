/*
 * Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export function validateCssObject(obj: any) {
    if (!obj || Object.keys(obj).length === 0) return false;

    return Object.entries(obj).every(([property, value]) => CSS.supports(property, String(value)));
}

export function getCssString(obj: any) {
    const yamlLikeString = Object.entries(obj)
        .map(([key, value]) => `\t${key}: ${value}`)
        .join('\n');
    return yamlLikeString;
}
