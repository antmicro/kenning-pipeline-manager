<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="settings-panel">

    </div>
</template>

<script>
export default {
    props: ["editor"]
}
</script>

<style lang="scss">
.settings-panel {
    height: 100px;
    width: 435px;
    top: 60px;
    background-color: $gray-600;
    opacity: 0.9;
    position: absolute;
    right: -495px;
    overflow-y: auto;
}
</style>