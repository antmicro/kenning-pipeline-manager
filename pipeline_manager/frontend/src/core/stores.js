/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { reactive } from 'vue';

/* eslint-disable import/prefer-default-export */
export const notificationStore = reactive({
    notifications: JSON.parse(localStorage.getItem('notifications')) || [],
    add(notification) {
        const newNotifications = [...this.notifications, notification];

        localStorage.setItem('notifications', JSON.stringify(newNotifications));
        this.notifications = newNotifications;
    },

    remove() {
        localStorage.removeItem('notifications');
        this.notifications = [];
    },

    removeOne(index) {
        const newNotifications = this.notifications.filter((_, idx) => index !== idx);

        localStorage.setItem('notifications', JSON.stringify(newNotifications));
        this.notifications = newNotifications;
    },
});

export const terminalStore = reactive({
    logs: JSON.parse(localStorage.getItem('logs')) || [],
    add(log) {
        const newNotifications = [...this.logs, log];

        localStorage.setItem('logs', JSON.stringify(newNotifications));
        this.logs = newNotifications;
    },

    /**
     * Adds a parsed notification. If there are messages, then it returns a following message:
     *
     * Title:
     *     message_first_line
     *     message_second_line
     *     ...
     *     message_last_line
     *
     * Otherwise, if messages are empty, then it returns a following message:
     *
     * Title.
     *
     * @param {string} title title of the message
     * @param {Array[string] | string | undefined} messages messages of the message
     */
    addParsed(title, messages) {
        let parsedMessage = title;
        if (messages) {
            if (typeof messages === 'string' || messages instanceof String) {
                messages = [messages]; // eslint-disable-line no-param-reassign
            }
            parsedMessage += ':';

            messages.forEach((message) => {
                parsedMessage += '\n';
                parsedMessage += '    ';
                parsedMessage += message;
            });
        } else {
            parsedMessage += '.';
        }
        this.add(parsedMessage);
    },

    remove() {
        localStorage.removeItem('logs');
        this.logs = [];
    },
});
