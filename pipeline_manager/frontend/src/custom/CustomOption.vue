<template>
    <component
        :is="component"
        :name="displayName"
        class="node-option disabled"
        :node="node"
        :value="value"
        :option="option"
        @input="updateValue"
    ></component>
</template>

<script>
import { Components } from '@baklavajs/plugin-renderer-vue';

export default {
    extends: Components.NodeOption,
    methods: {
        /**
         * Function that prevents overriding the value of the option
         * if the editor is in read-only mode.
         *
         * @param v New value of the input.
         */
        updateValue(v) {
            if (!this.plugin.editor.readonly) {
                this.option.value = v;
            }
        },
    },
};
</script>

<style>
.disabled {
    pointer-events: none;
}
</style>
