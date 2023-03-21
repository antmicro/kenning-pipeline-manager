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
