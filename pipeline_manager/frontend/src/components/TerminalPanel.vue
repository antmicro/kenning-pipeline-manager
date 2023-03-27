<template>
    <div class="container">
        <div class="tab">
            <button class="tab-item">
                <span>Kenning</span>
                <TerminalBadge :count="5" />
            </button>
            <button class="tab-item">
                <span>Pipeline Manger</span>
                <TerminalBadge :count="5" />
            </button>
        </div>

        <Arrow color="white" scale="small" rotate="up" />
    </div>
</template>

<script>
import TerminalBadge from './TerminalBadge.vue';
import Arrow from '../icons/Arrow.vue';

export default {
    components: {
        TerminalBadge,
        Arrow,
    },
};
</script>

<style lang="scss" scoped>
.container {
    position: absolute;
    bottom: 0;
    height: 35px;
    background-color: $gray-600;
    /* Calculation to prevent panel overflow */
    width: calc(100% - 2 * #{$spacing-xxl});
    display: flex;
    padding: 0 $spacing-xxl;
    align-items: center;
    justify-content: space-between;

    & > .tab {
        display: flex;
        gap: 40px;

        & > .tab-item {
            display: inherit;
            align-items: center;
            color: $white;
            gap: $spacing-m;

            & > span {
                font-size: $fs-small;
            }
        }
    }
}
</style>
