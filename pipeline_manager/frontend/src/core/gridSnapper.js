/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export default function gridSnapper(snapOffset) {
    const calculateSnappedPosition = (coord) => Math.round(coord / snapOffset) * snapOffset;

    return calculateSnappedPosition;
}
