<template>
    <span>
        {{ count }}
    </span>
</template>

<script>
export default {
    props: {
        count: {
            type: Number,
            required: true,
        },
    },
};
</script>

<style lang="scss" scoped>
span {
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background-color: $gray-500;
    color: $white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: $fs-small;
}
</style>
