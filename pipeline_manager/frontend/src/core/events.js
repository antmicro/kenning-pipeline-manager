/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable import/prefer-default-export */

// Mouse position
let y = 0;
let h = 0;

const mouseMoveHandler = (e) => {
    const { clientY } = e;
    const terminalWrapper = document.querySelector('.terminal-wrapper');
    const navBarHeight = 61;

    // Calculate mouse move
    const dy = y - clientY;

    // Prevent terminal overflow under nav bar
    if (clientY > navBarHeight) {
        terminalWrapper.style.height = `${h + dy}px`;
    }
};

const mouseUpHandler = () => {
    document.removeEventListener('mousemove', mouseMoveHandler);
    document.removeEventListener('mouseup', mouseUpHandler);
};

export const mouseDownHandler = (e) => {
    const terminalWrapper = document.querySelector('.terminal-wrapper');

    y = e.clientY;

    // Calculate height of terminal panel
    const styles = window.getComputedStyle(terminalWrapper);
    h = parseInt(styles.height, 10);

    document.addEventListener('mousemove', mouseMoveHandler);
    document.addEventListener('mouseup', mouseUpHandler);
};
