<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div>
        <input
            ref="input"
            type="text"
            class="dark-input"
            :value="value"
            @change="update"
            :placeholder="name"
        />
    </div>
</template>

<script>
export default {
    props: {
        value: {
            type: String,
            default: '',
        },
        name: {
            type: String,
        },
    },
    methods: {
        update(env) {
            this.$emit('input', env.target.value);
            this.$refs.input.value = this.value;
        },
    },
};
</script>
