<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="alert-bar">
        <button @click="$emit('input', false)" class="dismiss">Close</button> <br/>
        <div class="alert-box">{{ alertText }}</div>
        <LoadingBar v-show="loading"></LoadingBar>
    </div>
</template>

<script>
import LoadingBar from './LoadingBar.vue';

export default {
    components: {
        LoadingBar,
    },
    props: [
        'value',
        'alertText',
        'loading',
    ],
};
</script>

<style>
.dismiss {
    color: #dfdfdf;
    background-color: #F56D41;
}

.alert-box {
    text-align: center;
    color: #dfdfdf;
    margin: 10px;
}

.alert-bar {
    width: 100vw;
    border-top: 2px solid #000000;
}

</style>
