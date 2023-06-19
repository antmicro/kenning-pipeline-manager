/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Function for calculating node position based on given snapOffset.
 *
 * @param snapOffset Vue's reference to value containing snap offset
 */
export default function gridSnapper(snapOffset) {
    const calculateSnappedPosition = (coord) => Math.round(coord / snapOffset.value) * snapOffset.value;

    return calculateSnappedPosition;
}
