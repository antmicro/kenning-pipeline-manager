<template>
    <div class="terminal-container">
        <div class="command-results" ref="commands">
            <ul v-if="this.terminal === this.TerminalType.EXTERNAL">
                <li v-for="(command, index) in externalTerminalStore.commands" v-bind:key="index">
                    <TerminalCommand :command="command.command" :result="command.result" />
                </li>
            </ul>
            <ul v-else>
                <li v-for="(command, index) in pipelineTerminalStore.commands" v-bind:key="index">
                    <TerminalCommand :command="command.command" :result="command.result" />
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
import { externalTerminalStore, pipelineTerminalStore } from '../core/stores';
import TerminalCommand from './TerminalCommand.vue';
import { TerminalType } from '../core/utils';

export default {
    props: {
        terminal: {
            type: String,
            required: true,
        },
    },
    components: {
        TerminalCommand,
    },
    data() {
        return {
            TerminalType,
            externalTerminalStore,
            pipelineTerminalStore,
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
