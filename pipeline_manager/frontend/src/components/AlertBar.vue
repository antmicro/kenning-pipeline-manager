<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="alert-bar" v-show="displayed">
        <button @click="displayed = false" class="dismiss">Close</button> <br />
        <div class="alert-box">{{ alertText }}</div>
        <LoadingBar v-show="loading"></LoadingBar>
    </div>
</template>

<script>
import LoadingBar from './LoadingBar.vue';
import { alertBus } from '../core/bus';

export default {
    components: {
        LoadingBar,
    },
    data() {
        return {
            alertText: '',
            loading: false,
            displayed: false,
        };
    },
    created() {
        alertBus.$on('displayAlert', (alertText, loading = false) => {
            this.displayAlert(alertText, loading);
        });
    },
    methods: {
        displayAlert(alertText, loading = false) {
            this.alertText = alertText;
            this.loading = loading;
            this.displayed = true;
        },
    },
};
</script>

<style>
.dismiss {
    color: #dfdfdf;
    background-color: #f56d41;
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
