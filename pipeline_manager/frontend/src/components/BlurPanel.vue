<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="blur-panel">
        <slot />
    </div>
</template>

<style lang="scss">
.blur-panel {
    background-color: #{$gray-600}80;
    backdrop-filter: blur(10px);
    position: absolute;
    padding: $spacing-l;
    color: white;
    left: 0%;
    z-index: 10;
    top: 0%;
    width: 100%;
    height: 100%;
    min-height: fit-content;

    & > .panel {
        display: grid;
        grid-row-gap: $spacing-l;
        user-select: none;
        right: 25%;
        top: 25%;
        width: 50%;
        height: 50%;

        & > div {
            & > .option-label {
                padding-bottom: $spacing-s;
                color: $white;
                font-size: $fs-medium;
            }
        }
    }
}
</style>
