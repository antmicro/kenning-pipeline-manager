<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div class="command-container">
        <pre><span>{{ message }}</span></pre>
    </div>
</template>

<script>
export default {
    props: {
        message: {
            type: String,
            required: true,
        },
    },
};
</script>

<style lang="scss" scoped>
.command-container {
    width: 100%;
}

span {
    font-family: $roboto-mono;
    color: $white;
    font-size: $fs-small;
}
</style>
