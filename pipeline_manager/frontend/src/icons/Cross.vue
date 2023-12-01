<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!-- eslint-disable max-len -->
<template>
    <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path :class="color" d="M1 1L8 8" stroke-width="1.5" />
        <path :class="color" d="M8 1L1 8" stroke-width="1.5" />
    </svg>
</template>

<script>
export default {
    props: {
        color: {
            type: String,
            required: false,
        },
    },
};
</script>

<style lang="scss">
svg {
    stroke: $gray-200;
}
/* Color */
.white {
    stroke: $white;
}
</style>
