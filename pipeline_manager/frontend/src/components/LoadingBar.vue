<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="loading-bar">
        <div class="loading-delay1 loading-part"></div>
        <div class="loading-delay2 loading-part"></div>
        <div class="loading-delay3 loading-part"></div>
        <div class="loading-delay4 loading-part"></div>
    </div>
</template>

<style>
.loading-bar {
    background-color: #332d37;
    text-align: center;
}

.loading-part {
    display: inline-block;
    height: 25px;
    width: 25px;
    background-color: #f56d41;
    animation-duration: 1.2s;
    animation-iteration-count: infinite;
    animation-name: pulse-animation;
    margin: 15px;
}

.loading-delay1 {
    animation-delay: 0.15s;
}

.loading-delay2 {
    animation-delay: 0.3s;
}

.loading-delay3 {
    animation-delay: 0.45s;
}

.loading-delay4 {
    animation-delay: 0.6s;
}

@keyframes pulse-animation {
    0% {
        transform: scale(0.75);
        box-shadow: 0 0 0 0 #000000;
    }

    50% {
        transform: scale(1);
        box-shadow: 0 0 0 5px #928f94;
    }

    100% {
        transform: scale(0.75);
        box-shadow: 0 0 0 0 #000000;
    }
}
</style>
