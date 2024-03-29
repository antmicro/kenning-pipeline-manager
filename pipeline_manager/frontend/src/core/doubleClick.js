/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Helper function that can be used to handle double clicks.
 *
 * @param {number} timer time window in which a callback can be fired
 * @param {function} callback event fired on double click
 * @returns event that should be applied to @pointerdown
 */
export default function doubleClick(timer, callback) {
    const doubleClickTimer = timer;
    let lastClickTime = -doubleClickTimer;

    /* eslint-disable vue/no-mutating-props,no-param-reassign */
    const onMouseDown = () => {
        if (Date.now() - lastClickTime < doubleClickTimer) {
            callback();
        }
        lastClickTime = Date.now();
    };

    return onMouseDown;
}
