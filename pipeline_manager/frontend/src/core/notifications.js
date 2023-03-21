import { createToastInterface, POSITION } from 'vue-toastification';
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
};
