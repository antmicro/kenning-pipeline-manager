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
});
