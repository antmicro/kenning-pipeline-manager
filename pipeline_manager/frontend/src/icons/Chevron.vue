<!--
Copyright (c) 2026 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <svg
        class="chevron"
        :class="[rotate, { 'noninteractable': noninteractable }]"
        width="16"
        height="16"
        viewBox="0 0 7.41 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        >
        <path
            class="highlighted"
            :class="[color, hoverStatus, { 'noninteractable': noninteractable }]"
            d="M1.41 0L0 1.41L4.58 6L0 10.59L1.41 12L7.41 6L1.41 0Z"
            fill="#6F6F6F"
            stroke-width="0"
            />
        <polyline points="-2.59 3 3.41 9 9.41 3"></polyline>
    </svg>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue';

export default defineComponent({
    props: {
        color: {
            type: String,
            required: false,
        },
        rotate: {
            type: String,
            required: false,
        },
        hover: {
            type: Boolean,
            default: false,
        },
        noninteractable: {
            type: Boolean,
            default: false,
        },
    },
    setup(props) {
        const hoverStatus = computed(() => ({
            hovered: props.hover,
            normal: !props.hover,
        }));

        return { hoverStatus };
    },
});
</script>

<style lang="scss" scoped>
.white {
    fill: $white;
}

.green {
    fill: $green;
}

.black {
    fill: $black;
}

.down {
    rotate: 90deg;
}

.left {
    rotate: 180deg;
}

.up {
    rotate: 270deg;
}

.hovered {
    fill: $green;
}

.noninteractable {
    pointer-events: none;
}
</style>
