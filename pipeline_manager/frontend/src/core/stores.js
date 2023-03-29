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

export const externalTerminalStore = reactive({
    commands: JSON.parse(localStorage.getItem('commands-external')) || [],
    add(command) {
        const newCommands = [...this.commands, command];

        localStorage.setItem('commands-external', JSON.stringify(newCommands));
        this.commands = newCommands;
    },

    remove() {
        localStorage.removeItem('commands-external');
        this.commands = [];
    },
});

export const pipelineTerminalStore = reactive({
    commands: JSON.parse(localStorage.getItem('commands-pipeline')) || [],
    add(command) {
        const newCommands = [...this.commands, command];

        localStorage.setItem('commands-pipeline', JSON.stringify(newCommands));
        this.commands = newCommands;
    },

    remove() {
        localStorage.removeItem('commands-pipeline');
        this.commands = [];
    },
});
