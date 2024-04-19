<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<!-- eslint-disable vue/no-mutating-props -->
<template>
    <div class="popup-menu">
        <div class="__header">
            <div class="__header-title">
                {{ title }}
            </div>
            <Cross tabindex="-1" class="__close" @click="close" />
        </div>
        <slot></slot>
    </div>
</template>

<script>
import { defineComponent } from 'vue';
import Cross from '../../icons/Cross.vue';

export default defineComponent({
    props: {
        modelValue: {
            type: Boolean,
            default: false,
        },
        title: {
            required: true,
            type: String,
        },
    },
    components: {
        Cross,
    },
    setup(props, { emit }) {
        const close = () => {
            if (props.modelValue) {
                emit('update:modelValue', false);
            }
        };

        return { close };
    },
});
</script>

<style lang="scss">
    .popup-menu {
        position: absolute;
        background-color: #{$gray-600}E6;
        border: 1px solid $green;
        border-radius: 10px;
        color: white;
        user-select: none;

        left: 50vw;
        top: 50vh;
        transform: translate(-50%, -50%);
        padding: 1em;

        display: flex;
        flex-direction: column;
        gap: 1em;

        height: max-content;

        & > .__header {
            display: flex;
            align-items: center;
            gap: 2em;

            & > .__header-title {
                font-size: $fs-small;
                flex-grow: 1;
            }

            & > .__close {
                flex-grow: 0;
                user-select: none;
                outline: none;
                cursor: pointer;
            }
        }
    }
</style>
