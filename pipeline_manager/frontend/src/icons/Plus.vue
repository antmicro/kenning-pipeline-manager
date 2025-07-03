<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        shape-rendering="crispEdges"
        xmlns="http://www.w3.org/2000/svg"
    >
        <path d="M10.5 4V9.5H16V10.5H10.5V16H9.5V10.5H4V9.5H9.5V4H10.5Z" :class="hoverStatus" />
    </svg>
</template>

<script>
import { computed } from 'vue';

export default {
    props: {
        hover: {
            type: Boolean,
            required: false,
        },
    },
    setup(props) {
        const hoverStatus = computed(() => ({
            hovered: props.hover,
            normal: !props.hover,
        }));

        return { hoverStatus };
    },
};
</script>

<style lang="scss" scoped>
.normal {
    fill: #ffffff;
}

.hovered {
    fill: $green;
}
</style>
