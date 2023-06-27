<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle
            :class="color"
            id="magnifier-ellipse"
            cx="8.94758"
            cy="8.93587"
            r="5.85598"
            stroke="#E5E5E5"
            stroke-width="2.28477"
        />
        <rect
            :class="color"
            id="magnifier-rectangle"
            x="13.0214"
            y="13.7031"
            width="0.969325"
            height="5.11707"
            rx="0.484663"
            transform="rotate(-45 13.0214 13.7031)"
            stroke="#E5E5E5"
            stroke-width="0.969325"
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
    },
};
</script>

<style lang="scss">
/* Color */
.gray {
    stroke: $gray-200;
}
</style>
