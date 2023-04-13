<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div :class="border" class="notification-container">
        <div class="notification-badge">
            <NotificationBadge :type="type" />
        </div>
        <div class="notification-message">
            <span v-if="type === 'info'" :class="type">Info</span>
            <span v-if="type === 'warning'" :class="type">Warning</span>
            <span v-if="type === 'error'" :class="type">Error</span>
            <span class="message">{{ message }}</span>
        </div>
        <button @click="remove"><Cross color="white" /></button>
    </div>
</template>

<script>
import Cross from '../icons/Cross.vue';
import NotificationBadge from './NotificationBadge.vue';
import { notificationStore } from '../core/stores';

export default {
    components: {
        Cross,
        NotificationBadge,
    },
    props: {
        message: {
            type: String,
            required: true,
        },

        type: {
            type: String,
            required: true,
        },

        border: {
            type: String,
            default: 'none',
        },

        index: {
            type: Number,
            default: 0,
        },
    },
    data() {
        return {
            notificationStore,
        };
    },
    methods: {
        remove() {
            notificationStore.removeOne(this.index);
        },
    },
};
</script>

<style lang="scss" scoped>
.notification-container {
    display: flex;
    align-items: center;
    gap: $spacing-l;
    /* This calculation need to
     get width of space between paddings
     in notification panel
  */
    height: 90px;
    border-radius: 15px;
    padding: $spacing-m;

    &.border {
        border: 1px solid $gray-200;
    }

    & > .notification-badge {
        flex-basis: 35px;
    }

    & > .notification-message {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        font-size: $fs-small;
        width: 100%;

        & > .message {
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
        }

        & > .info {
            color: $green;
        }

        & > .warning {
            color: $gold;
        }

        & > .error {
            color: $red;
        }

        & > span:last-child {
            color: $white;
        }
    }
}
</style>
