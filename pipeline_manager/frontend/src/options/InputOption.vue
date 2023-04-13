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

<script lang="ts">
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
