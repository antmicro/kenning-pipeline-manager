<template>
    <div class="terminal-container">
        <div class="command-results" ref="commands">
            <ul>
                <li v-for="(log, index) in terminalStore.logs" v-bind:key="index">
                    <TerminalCommand :message="log" />
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
import TerminalCommand from './TerminalCommand.vue';
import { terminalStore } from '../core/stores';

export default {
    components: {
        TerminalCommand,
    },
    data() {
        return {
            terminalStore,
        };
    },
};
</script>

<style lang="scss" scoped>
.terminal-container {
    min-height: 360px;
    background-color: $gray-600;
    display: flex;
    flex-direction: column;
    flex: 1;

    & > .command-results {
        flex: 1;
        padding: $spacing-xxl;
        overflow-y: scroll;

        & {
            margin-right: $spacing-m;
        }
    }
}

input {
    font-family: $roboto-mono;
    bottom: 0;
    width: calc(100% - 40px);
    max-width: 100%;
    height: 55px;
    background-color: inherit;
    border: none;
    border-top: 1px solid $gray-500;
    color: $white;
    padding: 0 $spacing-l;
    outline: none;
}
</style>
