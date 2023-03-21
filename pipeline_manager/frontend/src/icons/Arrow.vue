<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!-- eslint-disable max-len -->
<template>
    <svg
        :class="[rotate, scale]"
        width="16"
        height="18"
        viewBox="0 0 16 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path
            :class="[color]"
            d="M16 18L7.33664 9.00005L16 4.78745e-05L8.65202 4.77869e-05L1.07327e-07 9.00005L8.65202 18L16 18Z"
            fill="#6F6F6F"
        />
    </svg>
</template>

<script>
export default {
    props: {
        color: {
            type: String,
            required: false,
        },
        rotate: {
            type: String,
            required: false,
        },
        scale: {
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

/* Rotate */
.left {
    rotate: 270deg;
}

.right {
    rotate: 180deg;
}

/* Scale */
.small {
    scale: 0.33;
}
</style>
