<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="notifications">
        <div class="info">
            <span>Notifications (3)</span>
            <button>
                <Cross />
                Clear all
            </button>
        </div>
        <div class="panel">
            <Notification message="Client connected" type="info" />
            <Notification
                message="Node type TensorFlowPetDataset MobileNetV2 is not registered"
                type="warning"
            />
            <Notification
                message="Node type TensorFlowPetDataset MobileNetV2 is not registered"
                type="error"
            />
        </div>
    </div>
</template>

<script>
import Cross from '../icons/Cross.vue';
import Notification from './Notification.vue';

export default {
    components: {
        Cross,
        Notification,
    },
};
</script>

<style lang="scss" scoped>
@import '../../styles/variables';

.notifications {
    height: calc(100vh - 120px);
    width: 435px;
    background-color: $gray-600;
    opacity: 0.9;
    position: absolute;
    top: 60px;
    right: -495px;
    z-index: 5;
    padding: $spacing-xxl;
    overflow-y: scroll;
    transition: transform 1s;

    & > .info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: $spacing-l;

        & > span {
            color: $white;
            font-size: $fs-large;
        }

        & > button {
            color: $gray-200;
            font-size: $fs-medium;
        }
    }

    & > .panel {
        display: grid;
        grid-row-gap: $spacing-l;
    }
}
</style>
