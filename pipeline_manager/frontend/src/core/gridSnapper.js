/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Function for calculating node position based on given movementStep.
 *
 * @param movementStep Vue's reference to value containing snap offset
 */
export default function gridSnapper(movementStep) {
    const calculateSnappedPosition = (coord) =>
        Math.round(coord / movementStep.value) * movementStep.value;

    return calculateSnappedPosition;
}
