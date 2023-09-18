<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!-- eslint-disable max-len -->
<template>
    <svg width="21" height="23" viewBox="0 0 21 23" fill="none" xmlns="http://www.w3.org/2000/svg" :class="classes">
        <path
            d="M0.791504 5.42584L10.0009 0L19.2787 5.43356L10.0694 10.8594L0.791504 5.42584Z"
            class="highlighted"
        />
        <path
            d="M10.8307 12.1946L20.0325 6.77649L20.002 17.5664L10.8003 22.9923L10.8307 12.1946Z"
            class="highlighted"
        />
        <path
            d="M0 17.5665L0.0304442 6.76111L9.3083 12.1947L9.27786 23L0 17.5665Z"
            class="highlighted"
        />
    </svg>
</template>

<script>
import { computed } from 'vue';

export default {
    props: {
        active: {
            type: Boolean,
            required: true,
        },
    },
    setup(props) {
        const classes = computed(() => ({
            __cubeActive: props.active,
            __cubeInactive: !props.active,
        }));

        return { classes };
    },
};
</script>

<style lang="scss" scoped>
.__cubeActive {
    > .highlighted {
        fill: $white;
    }

    &:hover > .highlighted {
        fill: $green;
    }
}

.__cubeInactive {
    > .highlighted {
        fill: #FFFFFF;
    }

    &:hover > .highlighted {
        fill: $green;
    }
}
</style>
