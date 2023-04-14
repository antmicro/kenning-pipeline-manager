<template>
    <div class="command-container">
        <span>{{ message }}</span>
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
