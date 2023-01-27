<!--
Copyright (c) 2022-2023 Antmicro <www.antmicro.com>

SPDX-License-Identifier: Apache-2.0
-->

<template>
    <div>
        <input
            type="text"
            class="dark-input"
            @change="update"
            :placeholder="name"
            :value="getValue()"
        >
    </div>
</template>

<script lang="ts">
export default {
    props: [
        /**
         * Name of the input
         */
        'name',
        /**
         * Property given by a parent component that conveys additional information
         * like `dtype` argument.
         */
        'option',
        /**
         * Value of the input
         */
        'value',
    ],
    data() {
        return {
            dtype: 'string',
        };
    },
    /**
     * If `dtype` was passed it is used. Otherwise `string` type is used.
     */
    mounted() {
        this.dtype = this.option.dtype || 'string';
        this.option.events.updated.addListener(this, () => {
            this.dtype = this.option.dtype || 'string';
        });
    },
    /* eslint-disable vue/no-deprecated-destroyed-lifecycle */
    beforeDestroy() {
        this.option.events.updated.removeListener(this);
    },
    methods: {
        /**
         * Gets called when the user changes value of the input.
         * It parses the value by trimming whitespaces, splitting the value.
         * into elements and converts them into a desired dtype.
         *
         * Then this value is passed to the parent component so when the editor.
         * is saved this parsed value is used for this list input.
         *
         * Example: '  3 2 5' with dtype string is parsed into ['3', '2', '5'].
         *
         * @param env event that is emitted when changing the input.
         *
         */
        update(env) {
            const splitted = env.target.value.trim().split(/\s+/);
            const parsed = splitted.map((e) => {
                switch (this.dtype) {
                case 'string':
                    return e.toString();
                case 'integer':
                    return parseInt(e, 10);
                case 'number':
                    return parseFloat(e);
                case 'boolean':
                    return Boolean(e);
                default:
                    return e;
                }
            });
            this.$emit('input', parsed);
        },
        /**
         * Function used to parse the value of the option so that it can be displayed.
         * Example ["1", "2"] is parsed into "1 2".
         * If there is no value then an empty string is returned.
         */
        getValue() {
            if (this.value != null) {
                return this.value.join(' ');
            }
            return '';
        },
    },
};
</script>
