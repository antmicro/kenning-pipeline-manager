<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="baklava-node --palette" :data-node-type="type">
        <div class="__title">
            <img class="__title-icon" v-if="svg !== undefined" :src="svg" />
            <div class="__title-label">
                {{ title }}
            </div>
        </div>
    </div>
</template>

<script>
import { defineComponent } from 'vue';

export default defineComponent({
    props: {
        type: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        iconPath: {
            type: String,
            required: false,
        },
    },
    setup(props) {
        const svg =
            props.iconPath !== undefined
                ? require(`${process.env.VUE_APP_NODE_ICONS_PATH}/${props.iconPath}`) // eslint-disable-line global-require,max-len,import/no-dynamic-require
                : undefined;
        return { svg };
    },
});
</script>
