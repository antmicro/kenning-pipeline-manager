<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="notification-container">
        <div class="notification-badge">
            <NotificationBadge :type="type" />
        </div>
        <div class="notification-message">
            <span v-if="type === 'info'" :class="type">Info</span>
            <span v-if="type === 'warning'" :class="type">Warning</span>
            <span v-if="type === 'error'" :class="type">Error</span>
            <span>{{ message }}</span>
        </div>
        <button><Cross color="white" /></button>
    </div>
</template>

<script>
import Cross from '../icons/Cross.vue';
import NotificationBadge from './NotificationBadge.vue';

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
    },
};
</script>

<style lang="scss" scoped>
.notification-container {
    display: flex;
    align-items: center;
    gap: $spacing-l;
    width: calc(100% - 2 * $spacing-xl);
    height: 90px;
    border: 1px solid $gray-200;
    border-radius: 15px;
    padding: 0 $spacing-m;

    & > .notification-badge {
        flex-basis: 35px;
    }

    & > .notification-message {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
        font-size: $fs-small;

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
