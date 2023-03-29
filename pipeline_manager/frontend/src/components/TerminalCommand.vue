<template>
    <div class="command-container">
        <Arrow scale="small" rotate="right" color="green" />
        <span class="command">{{ command }}</span>
        <span class="result">
            {{ result }}
        </span>
    </div>
</template>

<script>
import Arrow from '../icons/Arrow.vue';

export default {
    props: {
        command: {
            type: String,
            required: true,
        },
        result: {
            type: String,
            required: true,
        },
    },
    components: {
        Arrow,
    },
};
</script>

<style lang="scss" scoped>
.command-container {
    width: 100%;
    display: grid;
    grid-template-columns: 25px 1fr;
    grid-template-areas:
        'icon command'
        'result result';
    grid-row-gap: $spacing-m;

    & > .command {
        grid-area: command;
    }

    & > .result {
        grid-area: result;
    }
}

span {
    font-family: $roboto-mono;
    color: $white;
    font-size: $fs-small;
}
</style>
