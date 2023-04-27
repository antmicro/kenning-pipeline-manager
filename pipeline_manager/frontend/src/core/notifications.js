/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { createToastInterface, POSITION } from 'vue-toastification';
import { notificationStore, terminalStore } from './stores';
import Notification from '../components/Notification.vue';

const toast = createToastInterface({
    timeout: 5000,
    position: POSITION.BOTTOM_RIGHT,
    icon: false,
    closeButton: false,
});

/* eslint-disable import/prefer-default-export */
export const showToast = (type, message) => {
    const content = {
        component: Notification,
        props: {
            type,
            message,
        },
    };

    toast(content);
    notificationStore.add({ type, message });
};

/**
 * Helper function that displays the title of the message as a toast notification and
 * a full message in terminal with a proper title.
 *
 * @param {string} type Type of the toast notification
 * @param {string} title Title of the message used both for toast and terminal notification.
 * Preferably without any punctuation marks at the end
 * @param {Array[string] | string | undefined} messages messages that are displayed in the terminal
 */
export const terminalLog = (type, title, messages) => {
    showToast(type, title);
    terminalStore.addParsed(title, messages);
};
