<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!-- eslint-disable max-len -->
<template>
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg" class="stopdataflow">
        <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M12.5 20C16.6421 20 20 16.6421 20 12.5C20 8.35786 16.6421 5 12.5 5C8.35786 5 5 8.35786 5 12.5C5 16.6421 8.35786 20 12.5 20ZM16 11H9V14H16V11Z"
            fill="#6F6F6F"
            :class="[color]"
            class="highlighted"
            stroke-width="0"
        />
    </svg>
</template>

<script lang="ts">
export default {
    props: {
        color: {
            type: String,
            required: false,
        },
    },
};
</script>

<style lang="scss" scoped>
/* Color */
.white {
    fill: $white;
}

.stopdataflow:hover > .highlighted {
    fill: $green;
}
</style>
