<template>
    <div>
        <input
            type="text"
            class="dark-input"
            @change="update"
            :placeholder="name"
        >
    </div>
</template>

<script lang="ts">
export default {
    props: [
        'name',
        'option'
    ],
    data() {
        return {
            dtype: 'string'
        }
    },
    mounted() {
        this.dtype = this.option.dtype || 'string';
        this.option.events.updated.addListener(this, () => {
            this.dtype = this.option.dtype || 'string';
        });
    },
    beforeDestroy() {
        this.option.events.updated.removeListener(this);
    },
    methods: {
        update(env) {
            const splitted = env.target.value.trim().split(/\s+/);
            const parsed = splitted.map(e => {
                switch(this.dtype) {
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
            this.$emit("input", parsed);
        }
    }
}
</script>