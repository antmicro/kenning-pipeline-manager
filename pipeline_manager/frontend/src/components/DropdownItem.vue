<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div>
        <label v-if="type === 'file'" :for="id"> {{ text }} </label>
        <input v-if="type === 'file'" :id="id" type="file" @click="onClick" />
        <input v-else :id="id" type="button" @click="onClick" :value="text" />
    </div>
</template>

<script>
export default {
    props: {
        text: {
            type: String,
            required: true,
        },
        id: {
            type: String,
        },
        type: {
            type: String,
            default: 'file',
        },
        onClick: {
            type: Function,
            required: true,
        },
    },
};
</script>

<style lang="scss" scoped>
@import '../../styles/variables.scss';

div {
    display: flex;
    justify-content: space-between;
    width: 160px;
    flex-direction: row;
    padding: $spacing-s $spacing-s;
    align-items: center;

    & > input[type='button'],
    label {
        width: 100%;
        font-size: $fs-small;
        color: $white;
        background-color: unset;
        border: unset;
        cursor: pointer;
    }
}
</style>
