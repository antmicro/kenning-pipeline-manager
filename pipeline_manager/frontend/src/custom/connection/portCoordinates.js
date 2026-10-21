/*
 * Copyright (c) 2022-2026 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

export default function getPortCoordinates(resolved) {
    if (resolved.node && resolved.interface && resolved.port) {
        // Sum the offsets along the whole offsetParent chain from the port up to the node.
        let x = 0;
        let y = 0;
        let element = resolved.port;
        while (element !== null && element !== resolved.node && element !== document.body) {
            x += element.offsetLeft;
            y += element.offsetTop;
            element = element.offsetParent;
        }
        if (element !== resolved.node) {
            return [0, 0];
        }
        return [
            x + resolved.node.offsetLeft + resolved.port.clientWidth / 2,
            y + resolved.node.offsetTop + resolved.port.clientHeight / 2,
        ];
    }
    return [0, 0];
}
