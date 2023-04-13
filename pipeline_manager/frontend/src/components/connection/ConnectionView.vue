<template>
    <path
        :d="d"
        :class="cssClasses"
    ></path>
</template>

<script>
import { Components } from '@baklavajs/plugin-renderer-vue';

export default {
    extends: Components.Connection,
    props: ["isHighlighted"],

    computed: {
        cssClasses() {
            return {...this.classes, "--hover": this.isHighlighted}
        }
    }
}
</script>