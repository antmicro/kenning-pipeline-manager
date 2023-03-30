<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="notifications">
        <div class="info">
            <span>Notifications</span>
            <button>
                <Cross />
                Clear all
            </button>
        </div>
        <div class="panel" />
    </div>
</template>

<script>
import Cross from '../icons/Cross.vue';

export default {
    components: {
        Cross,
    },
};
</script>

<style lang="scss" scoped>
.notifications {
    /* Set height to 100 view port minus height of navigation bar and paddings */
    height: calc(100vh - 120px);
    width: 435px;
    background-color: $gray-600;
    opacity: 0.9;
    position: absolute;
    /* Height of navigation bar*/
    top: 60px;
    /* As defeault notification panel is hidden (minus value)
      panel width (435px) + 2 * padding (30px) = 495px
    */
    right: -495px;
    z-index: 5;
    padding: $spacing-xxl;
    overflow-y: scroll;

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
