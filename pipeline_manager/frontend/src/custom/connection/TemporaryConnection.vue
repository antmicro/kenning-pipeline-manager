<template>
    <ConnectionView
        :x1="d.input[0]"
        :y1="d.input[1]"
        :x2="d.output[0]"
        :y2="d.output[1]"
        :state="status"
        :connection="connection"
        is-temporary
    />
</template>

<script>
import { Components } from 'baklavajs';
import ConnectionView from './ConnectionView.vue';

export default {
    extends: Components.TemporaryConnection,
    components: {
        ConnectionView,
    },
    setup(props) {
        return Components.TemporaryConnection.setup(props);
    },
};
</script>
