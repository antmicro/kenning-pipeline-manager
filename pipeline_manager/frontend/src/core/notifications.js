/*
 * Copyright (c) 2022-2023 Antmicro <www.antmicro.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { createToastInterface, POSITION } from 'vue-toastification';
import { notificationStore } from './stores';
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
            message: `${message}`,
        },
    };

    toast(content);
    notificationStore.add({ type, message });
};
