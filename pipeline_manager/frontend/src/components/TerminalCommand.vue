<template>
    <div class="command-container">
        <NotificationBadge :type="this.type" size="small" />
        <span class="result">{{ this.message }}</span>
    </div>
</template>

<script>
import NotificationBadge from './NotificationBadge.vue';

export default {
    props: {
        type: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
    },
    components: {
        NotificationBadge,
    },
};
</script>

<style lang="scss" scoped>
.command-container {
    width: 100%;
    display: grid;
    grid-template-columns: 50px 1fr;
    grid-row-gap: $spacing-m;
}

div,
span {
    align-self: center;
}

span {
    font-family: $roboto-mono;
    color: $white;
    font-size: $fs-small;
}
</style>
